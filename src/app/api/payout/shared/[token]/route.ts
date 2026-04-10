import { createHash } from "node:crypto";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const SHARE_LINK_TTL_DAYS = 30;

const preferredBotTokenByGuild = new Map<string, string>();

type DiscordGuildMemberResponse = {
    roles?: string[];
};

function hashShareToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

function getDiscordBotTokens(): string[] {
    const multi = (process.env.DISCORD_BOT_TOKENS ?? "")
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);
    const single = (process.env.DISCORD_BOT_TOKEN ?? "").trim();

    return [...new Set([...multi, ...(single ? [single] : [])])];
}

async function fetchGuildMemberRoleMatch(params: {
    guildId: string;
    discordUserId: string;
    requiredRoleId: string;
}): Promise<{ ok: true; hasRole: boolean } | { ok: false; status: number; error: string }> {
    const tokens = getDiscordBotTokens();

    if (tokens.length === 0) {
        return { ok: false, status: 500, error: "No bot token configured" };
    }

    const preferred = preferredBotTokenByGuild.get(params.guildId);
    const orderedTokens = preferred
        ? [preferred, ...tokens.filter((token) => token !== preferred)]
        : tokens;

    let lastStatus = 0;

    for (const botToken of orderedTokens) {
        const response = await fetch(
            `https://discord.com/api/v10/guilds/${params.guildId}/members/${params.discordUserId}`,
            {
                headers: {
                    Authorization: `Bot ${botToken}`,
                },
                cache: "no-store",
            },
        );

        if (response.status === 404) {
            return { ok: true, hasRole: false };
        }

        if (!response.ok) {
            lastStatus = response.status;
            continue;
        }

        preferredBotTokenByGuild.set(params.guildId, botToken);
        const member = (await response.json()) as DiscordGuildMemberResponse;

        return {
            ok: true,
            hasRole: Boolean(member.roles?.includes(params.requiredRoleId)),
        };
    }

    return {
        ok: false,
        status: 503,
        error:
            lastStatus > 0
                ? `Unable to verify Discord role (status ${lastStatus})`
                : "Unable to verify Discord role",
    };
}

function resolveMultiplier(value: number | null | undefined): number {
    return value || 1;
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ token: string }> },
) {
    try {
        const { token } = await params;
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: {
                id: true,
                discordId: true,
            },
        });

        if (!user?.discordId) {
            return NextResponse.json(
                { error: "Discord account not linked" },
                { status: 403 },
            );
        }

        const share = await prisma.payoutSessionShare.findUnique({
            where: {
                shareTokenHash: hashShareToken(token),
            },
            include: {
                session: {
                    include: {
                        entries: {
                            orderBy: [{ displayName: "asc" }, { username: "asc" }],
                        },
                    },
                },
            },
        });

        if (!share) {
            return NextResponse.json({ error: "Shared session not found" }, { status: 404 });
        }

        const expiresAt = new Date(
            share.updatedAt.getTime() + SHARE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000,
        );

        if (expiresAt.getTime() <= Date.now()) {
            return NextResponse.json(
                { error: "This shared link has expired. Ask an admin to generate a new one." },
                { status: 410 },
            );
        }

        const guildConfiguration = await prisma.guildConfiguration.findUnique({
            where: { discordGuildId: share.discordGuildId },
            select: {
                zooMemberRoleId: true,
                zooMemberRoleName: true,
                warsCount: true,
                racesCount: true,
                reviewsCount: true,
                bonusCount: true,
                invasionsCount: true,
                vodsCount: true,
            },
        });

        if (!guildConfiguration?.zooMemberRoleId) {
            return NextResponse.json(
                {
                    error:
                        "No access role is configured for this server. Ask an admin to configure it.",
                },
                { status: 403 },
            );
        }

        const membership = await fetchGuildMemberRoleMatch({
            guildId: share.discordGuildId,
            discordUserId: user.discordId,
            requiredRoleId: guildConfiguration.zooMemberRoleId,
        });

        if (!membership.ok) {
            return NextResponse.json(
                { error: membership.error },
                { status: membership.status },
            );
        }

        if (!membership.hasRole) {
            return NextResponse.json(
                { error: "You do not have the required role for this shared session" },
                { status: 403 },
            );
        }

        const multipliers = {
            wars: resolveMultiplier(guildConfiguration.warsCount),
            races: resolveMultiplier(guildConfiguration.racesCount),
            reviews: resolveMultiplier(guildConfiguration.reviewsCount),
            bonus: resolveMultiplier(guildConfiguration.bonusCount),
            invasions: resolveMultiplier(guildConfiguration.invasionsCount),
            vods: resolveMultiplier(guildConfiguration.vodsCount),
        };

        const entries = share.session.entries.map((entry) => {
            const points =
                entry.wars * multipliers.wars +
                entry.races * multipliers.races +
                entry.reviews * multipliers.reviews +
                entry.bonus * multipliers.bonus +
                entry.invasions * multipliers.invasions +
                entry.vods * multipliers.vods;

            return {
                id: entry.id,
                username: entry.username,
                displayName: entry.displayName,
                wars: entry.wars,
                races: entry.races,
                reviews: entry.reviews,
                bonus: entry.bonus,
                invasions: entry.invasions,
                vods: entry.vods,
                points,
            };
        });

        const totalPoints = entries.reduce((sum, entry) => sum + entry.points, 0);
        const goldPerPoint = totalPoints > 0 ? share.session.goldPool / totalPoints : 0;

        return NextResponse.json({
            session: {
                id: share.session.id,
                name: share.session.name,
                createdAt: share.session.createdAt,
                shareExpiresAt: expiresAt,
                totalConfiguredBalance: share.session.goldPool,
                totalPoints,
                goldPerPoint,
            },
            accessRole: {
                id: guildConfiguration.zooMemberRoleId,
                name: guildConfiguration.zooMemberRoleName,
            },
            entries: entries.map((entry) => ({
                ...entry,
                goldEarned: entry.points * goldPerPoint,
            })),
        });
    } catch (error) {
        console.error("GET /api/payout/shared/[token]", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
