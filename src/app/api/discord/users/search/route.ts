import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireAuth, requireGuildAuth } from "@/lib/route-guard";

export const dynamic = "force-dynamic";

// Simple in-memory cache with TTL (5 minutes)
const userSearchCache: Map<
    string,
    {
        results: Array<{
            id: string;
            username: string;
            displayName: string;
            avatar: string | null;
        }>;
        timestamp: number;
    }
> = new Map();

const preferredBotTokenByGuild = new Map<string, string>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_ENTRIES = 500;
const DISCORD_FETCH_TIMEOUT_MS = 7_000;

type DiscordMember = {
    roles?: string[];
    user: {
        id: string;
        username: string;
        global_name: string | null;
        avatar: string | null;
    };
};

function parseRetryAfterSeconds(value: string | null): number | null {
    if (!value) {
        return null;
    }

    const asNumber = Number.parseFloat(value);
    if (!Number.isFinite(asNumber) || asNumber <= 0) {
        return null;
    }

    return Math.ceil(asNumber);
}

function pruneUserSearchCache() {
    if (userSearchCache.size <= CACHE_MAX_ENTRIES) {
        return;
    }

    const now = Date.now();
    for (const [key, value] of userSearchCache.entries()) {
        if (now - value.timestamp >= CACHE_TTL) {
            userSearchCache.delete(key);
        }
    }

    if (userSearchCache.size <= CACHE_MAX_ENTRIES) {
        return;
    }

    const entries = Array.from(userSearchCache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp,
    );
    const overflow = userSearchCache.size - CACHE_MAX_ENTRIES;

    for (let i = 0; i < overflow; i += 1) {
        const key = entries[i]?.[0];
        if (key) {
            userSearchCache.delete(key);
        }
    }
}

function getDiscordBotTokens(): string[] {
    const multi = (process.env.DISCORD_BOT_TOKENS ?? "")
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);
    const single = (process.env.DISCORD_BOT_TOKEN ?? "").trim();

    return [...new Set([...multi, ...(single ? [single] : [])])];
}

export const GET = apiHandler("GET /api/discord/users/search", async (request: NextRequest) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim().toLowerCase() || "";

    if (query.length < 2) {
        return NextResponse.json([]);
    }

    const guild = await requireGuildAuth(
        auth.email,
        searchParams.get("guildId"),
        "payout",
        "read",
    );
    if ("response" in guild) return guild.response;

    const guildId = guild.resolved.guildId;

    // Get guild config to check for Zoo member role
    const guildConfig = await prisma.guildConfiguration.findUnique({
        where: { discordGuildId: guildId },
        select: { zooMemberRoleId: true },
    });

    const zooRoleId = guildConfig?.zooMemberRoleId;

    // Check cache
    const cacheKey = `${guildId}:${query}:${zooRoleId || "any"}`;
    const cached = userSearchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.results);
    }

    // Get bot tokens
    const tokens = getDiscordBotTokens();
    if (tokens.length === 0) {
        return NextResponse.json({ error: "No bot token configured" }, { status: 500 });
    }

    // Try tokens in order (preferred first)
    const preferred = preferredBotTokenByGuild.get(guildId);
    const orderedTokens = preferred
        ? [preferred, ...tokens.filter((token) => token !== preferred)]
        : tokens;

    let results: Array<{
        id: string;
        username: string;
        displayName: string;
        avatar: string | null;
    }> = [];
    let success = false;
    let sawRateLimit = false;
    let retryAfterSeconds: number | null = null;
    let sawTransientFailure = false;

    for (const botToken of orderedTokens) {
        let members: DiscordMember[] = [];
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), DISCORD_FETCH_TIMEOUT_MS);

        try {
            // Always use Discord native search first
            const membersRes = await fetch(
                `https://discord.com/api/v10/guilds/${guildId}/members/search?query=${encodeURIComponent(query)}&limit=100`,
                {
                    headers: {
                        Authorization: `Bot ${botToken}`,
                    },
                    signal: controller.signal,
                    cache: "no-store",
                }
            );
            clearTimeout(timeout);

            if (membersRes.status === 429) {
                sawRateLimit = true;
                const parsedRetry = parseRetryAfterSeconds(
                    membersRes.headers.get("retry-after"),
                );
                if (parsedRetry !== null) {
                    retryAfterSeconds =
                        retryAfterSeconds === null
                            ? parsedRetry
                            : Math.max(retryAfterSeconds, parsedRetry);
                }
                continue;
            }

            if (!membersRes.ok) {
                if (membersRes.status >= 500) {
                    sawTransientFailure = true;
                }
                continue;
            }

            members = (await membersRes.json()) as DiscordMember[];

            // If Zoo role is set, filter members by that role
            if (zooRoleId) {
                members = members.filter((m) =>
                    m.roles && m.roles.includes(zooRoleId)
                );
            }
        } catch {
            clearTimeout(timeout);
            sawTransientFailure = true;
            continue;
        }

        // Success! Remember this token
        preferredBotTokenByGuild.set(guildId, botToken);
        success = true;

        results = members.map((member) => ({
            id: member.user.id,
            username: member.user.username,
            displayName: member.user.global_name || member.user.username,
            avatar: member.user.avatar
                ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png`
                : null,
        }));

        break;
    }

    if (!success) {
        if (sawRateLimit || sawTransientFailure) {
            const headers = new Headers();
            if (retryAfterSeconds !== null) {
                headers.set("Retry-After", String(retryAfterSeconds));
            }

            return NextResponse.json(
                { error: "Discord API temporarily unavailable" },
                { status: 503, headers },
            );
        }

        return NextResponse.json([]);
    }

    pruneUserSearchCache();

    // Cache results
    userSearchCache.set(cacheKey, {
        results,
        timestamp: Date.now(),
    });

    return NextResponse.json(results);
});
