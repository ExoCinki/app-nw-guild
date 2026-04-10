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

type RoleMatchResult = {
    ok: true;
    hasRole: boolean;
    source: "user-token" | "bot-token";
    roles: string[];
};

async function refreshDiscordAccessToken(
    refreshToken: string,
): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: number | null;
} | null> {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return null;
    }

    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
    });

    const response = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        cache: "no-store",
    });

    if (!response.ok) {
        return null;
    }

    const payload = (await response.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
    };

    if (!payload.access_token) {
        return null;
    }

    return {
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token ?? refreshToken,
        expiresAt:
            typeof payload.expires_in === "number"
                ? Math.floor(Date.now() / 1000) + payload.expires_in
                : null,
    };
}

async function fetchCurrentUserGuildRoleMatch(params: {
    userId: string;
    guildId: string;
    requiredRoleId: string;
}): Promise<RoleMatchResult | null> {
    const account = await prisma.account.findFirst({
        where: {
            userId: params.userId,
            provider: "discord",
        },
        select: {
            id: true,
            access_token: true,
            refresh_token: true,
        },
    });

    if (!account?.access_token) {
        return null;
    }

    const fetchMembership = async (accessToken: string) =>
        fetch(`https://discord.com/api/v10/users/@me/guilds/${params.guildId}/member`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            cache: "no-store",
        });

    let response = await fetchMembership(account.access_token);

    if ((response.status === 401 || response.status === 403) && account.refresh_token) {
        const refreshed = await refreshDiscordAccessToken(account.refresh_token);

        if (refreshed) {
            await prisma.account.update({
                where: { id: account.id },
                data: {
                    access_token: refreshed.accessToken,
                    refresh_token: refreshed.refreshToken,
                    expires_at: refreshed.expiresAt,
                },
            });

            response = await fetchMembership(refreshed.accessToken);
        }
    }

    if (response.status === 404) {
        return { ok: true, hasRole: false, source: "user-token", roles: [] };
    }

    if (!response.ok) {
        return null;
    }

    const member = (await response.json()) as DiscordGuildMemberResponse;

    return {
        ok: true,
        hasRole: Boolean(member.roles?.includes(params.requiredRoleId)),
        source: "user-token",
        roles: member.roles ?? [],
    };
}

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
}): Promise<RoleMatchResult | { ok: false; status: number; error: string }> {
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
            return { ok: true, hasRole: false, source: "bot-token", roles: [] };
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
            source: "bot-token",
            roles: member.roles ?? [],
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

        const tokenHash = hashShareToken(token);
        const normalizedTokenHash = hashShareToken(token.toLowerCase());

        const share = await prisma.payoutSessionShare.findFirst({
            where: {
                shareTokenHash: {
                    in:
                        tokenHash === normalizedTokenHash
                            ? [tokenHash]
                            : [tokenHash, normalizedTokenHash],
                },
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
            return NextResponse.json(
                {
                    error:
                        "Shared session not found. The link may have been regenerated or is invalid.",
                },
                { status: 404 },
            );
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

        const userMembership = await fetchCurrentUserGuildRoleMatch({
            userId: user.id,
            guildId: share.discordGuildId,
            requiredRoleId: guildConfiguration.zooMemberRoleId,
        });

        const membership =
            userMembership ??
            (await fetchGuildMemberRoleMatch({
                guildId: share.discordGuildId,
                discordUserId: user.discordId,
                requiredRoleId: guildConfiguration.zooMemberRoleId,
            }));

        if (!membership.ok) {
            return NextResponse.json(
                { error: membership.error },
                { status: membership.status },
            );
        }

        if (!membership.hasRole) {
            const roleNameById = new Map<string, string>();
            const uniqueRoleIds = Array.from(new Set([
                guildConfiguration.zooMemberRoleId,
                ...membership.roles,
            ]));

            if (uniqueRoleIds.length > 0) {
                const botTokens = getDiscordBotTokens();

                for (const botToken of botTokens) {
                    const rolesResponse = await fetch(
                        `https://discord.com/api/v10/guilds/${share.discordGuildId}/roles`,
                        {
                            headers: {
                                Authorization: `Bot ${botToken}`,
                            },
                            cache: "no-store",
                        },
                    );

                    if (!rolesResponse.ok) {
                        continue;
                    }

                    const rolesPayload = (await rolesResponse.json()) as Array<{
                        id: string;
                        name: string;
                    }>;

                    for (const role of rolesPayload) {
                        if (uniqueRoleIds.includes(role.id)) {
                            roleNameById.set(role.id, role.name);
                        }
                    }

                    break;
                }
            }

            return NextResponse.json(
                {
                    error:
                        "You do not have the required role for this shared session. If you recently changed permissions, sign out and sign back in with Discord.",
                    debug: {
                        requiredRole: {
                            id: guildConfiguration.zooMemberRoleId,
                            name:
                                guildConfiguration.zooMemberRoleName ??
                                roleNameById.get(guildConfiguration.zooMemberRoleId) ??
                                null,
                        },
                        verificationSource: membership.source,
                        detectedRoles: membership.roles.map((roleId) => ({
                            id: roleId,
                            name: roleNameById.get(roleId) ?? null,
                        })),
                    },
                },
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
