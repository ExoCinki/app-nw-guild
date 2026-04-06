import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";
import { NextRequest, NextResponse } from "next/server";

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

function getDiscordBotTokens(): string[] {
    const multi = (process.env.DISCORD_BOT_TOKENS ?? "")
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);
    const single = (process.env.DISCORD_BOT_TOKEN ?? "").trim();

    return [...new Set([...multi, ...(single ? [single] : [])])];
}

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const guilds = await getManagedWhitelistedGuilds(session.user.email);
        if (!guilds || guilds.length === 0) {
            return NextResponse.json({ error: "No managed guilds" }, { status: 403 });
        }

        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get("q")?.toLowerCase() || "";

        if (query.length < 2) {
            return NextResponse.json([]);
        }

        const guildId = guilds[0].id;

        // Check cache
        const cacheKey = `${guildId}:${query}`;
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

        let results = [];
        let success = false;

        for (const botToken of orderedTokens) {
            const membersRes = await fetch(
                `https://discord.com/api/v10/guilds/${guildId}/members/search?query=${encodeURIComponent(query)}&limit=25`,
                {
                    headers: {
                        Authorization: `Bot ${botToken}`,
                    },
                }
            );

            if (!membersRes.ok) {
                console.error(
                    `Discord API error with token ${botToken.slice(0, 10)}...:`,
                    membersRes.status
                );
                continue;
            }

            // Success! Remember this token
            preferredBotTokenByGuild.set(guildId, botToken);
            success = true;

            const members = await membersRes.json();
            results = members.map(
                (member: {
                    user: {
                        id: string;
                        username: string;
                        global_name: string | null;
                        avatar: string | null;
                    };
                }) => ({
                    id: member.user.id,
                    username: member.user.username,
                    displayName: member.user.global_name || member.user.username,
                    avatar: member.user.avatar
                        ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png`
                        : null,
                })
            );

            break;
        }

        if (!success) {
            console.error("All Discord bot tokens failed for guild:", guildId);
            return NextResponse.json([]);
        }
        // Cache results
        userSearchCache.set(cacheKey, {
            results,
            timestamp: Date.now(),
        });

        return NextResponse.json(results);
    } catch (error) {
        console.error("GET /api/discord/users/search", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
