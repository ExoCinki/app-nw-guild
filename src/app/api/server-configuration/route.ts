import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";
import { hasGuildScopeAccess, type GuildAccessMode } from "@/lib/admin-access";
import { getDiscordGuildRoles } from "@/lib/discord-guild-roles";

export const dynamic = "force-dynamic";

function parseNonNegativeInt(value: unknown, fieldName: string): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
        throw new Error(`${fieldName} must be a non-negative integer`);
    }

    return value;
}

async function resolveGuildForUser(
    email: string,
    guildIdFromQuery: string | null,
    mode: GuildAccessMode,
) {
    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, discordId: true },
    });

    if (!user) {
        return { error: "User not found", status: 404 as const };
    }

    const manageableGuildsResult = await getManagedWhitelistedGuilds(email);

    if (!manageableGuildsResult.ok) {
        return {
            error: manageableGuildsResult.error,
            status: manageableGuildsResult.status,
        };
    }

    const manageableGuilds = manageableGuildsResult.guilds;

    let guildId = guildIdFromQuery;

    if (!guildId) {
        const selectedGuild = await prisma.selectedGuild.findUnique({
            where: { userId: user.id },
            select: { discordGuildId: true },
        });

        guildId = selectedGuild?.discordGuildId ?? null;
    }

    if (!guildId) {
        return { error: "No guild selected", status: 400 as const };
    }

    const hasAccess = manageableGuilds.some((guild) => guild.id === guildId);

    if (!hasAccess) {
        return {
            error: "Guild is not manageable for this account",
            status: 403 as const,
        };
    }

    const ownerDiscordId = process.env.OWNER_DISCORD_ID;
    const isOwner = Boolean(
        ownerDiscordId && user.discordId && user.discordId === ownerDiscordId,
    );

    const canAccessConfiguration = await hasGuildScopeAccess({
        userId: user.id,
        discordGuildId: guildId,
        scope: "configuration",
        mode,
        isOwner,
    });

    if (!canAccessConfiguration) {
        return {
            error: "Access denied for configuration module on this server",
            status: 403 as const,
        };
    }

    const guildName =
        manageableGuilds.find((guild) => guild.id === guildId)?.name ?? null;

    return {
        userId: user.id,
        guildId,
        guildName,
    };
}

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const requestedGuildId = url.searchParams.get("guildId");

    const resolved = await resolveGuildForUser(session.user.email, requestedGuildId, "read");

    if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const config = await prisma.guildConfiguration.findUnique({
        where: { discordGuildId: resolved.guildId },
        select: {
            apiKey: true,
            channelId: true,
            enableSecondRoster: true,
            zooMemberRoleId: true,
            zooMemberRoleName: true,
            warsCount: true,
            racesCount: true,
            invasionsCount: true,
            vodsCount: true,
            reviewsCount: true,
            bonusCount: true,
            updatedAt: true,
        },
    });

    const { roles, rolesError } = await getDiscordGuildRoles(resolved.guildId);

    return NextResponse.json({
        guild: {
            id: resolved.guildId,
            name: resolved.guildName,
        },
        roles,
        rolesError,
        configuration: {
            apiKey: config?.apiKey ?? "",
            channelId: config?.channelId ?? "",
            enableSecondRoster: config?.enableSecondRoster ?? false,
            zooMemberRoleId: config?.zooMemberRoleId ?? "",
            zooMemberRoleName: config?.zooMemberRoleName ?? "",
            warsCount: config?.warsCount ?? 0,
            racesCount: config?.racesCount ?? 0,
            invasionsCount: config?.invasionsCount ?? 0,
            vodsCount: config?.vodsCount ?? 0,
            reviewsCount: config?.reviewsCount ?? 0,
            bonusCount: config?.bonusCount ?? 0,
            updatedAt: config?.updatedAt ?? null,
        },
    });
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as {
        guildId?: string;
        apiKey?: string;
        channelId?: string;
        enableSecondRoster?: boolean;
        zooMemberRoleId?: string | null;
        warsCount?: number;
        racesCount?: number;
        invasionsCount?: number;
        vodsCount?: number;
        reviewsCount?: number;
        bonusCount?: number;
    };

    const resolved = await resolveGuildForUser(
        session.user.email,
        payload.guildId ?? null,
        "write",
    );

    if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const existing = await prisma.guildConfiguration.findUnique({
        where: { discordGuildId: resolved.guildId },
        select: {
            apiKey: true,
            channelId: true,
            enableSecondRoster: true,
            zooMemberRoleId: true,
            zooMemberRoleName: true,
            warsCount: true,
            racesCount: true,
            invasionsCount: true,
            vodsCount: true,
            reviewsCount: true,
            bonusCount: true,
        },
    });

    const hasApiKey = Object.prototype.hasOwnProperty.call(payload, "apiKey");
    const hasChannelId = Object.prototype.hasOwnProperty.call(payload, "channelId");
    const hasEnableSecondRoster = Object.prototype.hasOwnProperty.call(
        payload,
        "enableSecondRoster",
    );
    const hasZooMemberRoleId = Object.prototype.hasOwnProperty.call(
        payload,
        "zooMemberRoleId",
    );
    const hasWarsCount = Object.prototype.hasOwnProperty.call(payload, "warsCount");
    const hasRacesCount = Object.prototype.hasOwnProperty.call(payload, "racesCount");
    const hasInvasionsCount = Object.prototype.hasOwnProperty.call(payload, "invasionsCount");
    const hasVodsCount = Object.prototype.hasOwnProperty.call(payload, "vodsCount");
    const hasReviewsCount = Object.prototype.hasOwnProperty.call(payload, "reviewsCount");
    const hasBonusCount = Object.prototype.hasOwnProperty.call(payload, "bonusCount");

    const apiKey = hasApiKey
        ? (payload.apiKey ?? "").trim() || null
        : existing?.apiKey ?? null;
    const channelId = hasChannelId
        ? (payload.channelId ?? "").trim() || null
        : existing?.channelId ?? null;

    let enableSecondRoster = existing?.enableSecondRoster ?? false;

    if (hasEnableSecondRoster) {
        if (typeof payload.enableSecondRoster !== "boolean") {
            return NextResponse.json(
                { error: "enableSecondRoster must be a boolean" },
                { status: 400 },
            );
        }

        enableSecondRoster = payload.enableSecondRoster;
    }

    let warsCount = existing?.warsCount ?? 0;
    let racesCount = existing?.racesCount ?? 0;
    let invasionsCount = existing?.invasionsCount ?? 0;
    let vodsCount = existing?.vodsCount ?? 0;
    let reviewsCount = existing?.reviewsCount ?? 0;
    let bonusCount = existing?.bonusCount ?? 0;

    try {
        if (hasWarsCount) {
            warsCount = parseNonNegativeInt(payload.warsCount, "warsCount");
        }
        if (hasRacesCount) {
            racesCount = parseNonNegativeInt(payload.racesCount, "racesCount");
        }
        if (hasInvasionsCount) {
            invasionsCount = parseNonNegativeInt(payload.invasionsCount, "invasionsCount");
        }
        if (hasVodsCount) {
            vodsCount = parseNonNegativeInt(payload.vodsCount, "vodsCount");
        }
        if (hasReviewsCount) {
            reviewsCount = parseNonNegativeInt(payload.reviewsCount, "reviewsCount");
        }
        if (hasBonusCount) {
            bonusCount = parseNonNegativeInt(payload.bonusCount, "bonusCount");
        }
    } catch (error) {
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Invalid numeric fields",
            },
            { status: 400 },
        );
    }

    let zooMemberRoleId = existing?.zooMemberRoleId ?? null;
    let zooMemberRoleName = existing?.zooMemberRoleName ?? null;

    if (hasZooMemberRoleId) {
        const incomingRoleId = (payload.zooMemberRoleId ?? "").trim();

        if (!incomingRoleId) {
            zooMemberRoleId = null;
            zooMemberRoleName = null;
        } else {
            const { roles, rolesError } = await getDiscordGuildRoles(resolved.guildId);

            if (rolesError) {
                return NextResponse.json(
                    {
                        error: rolesError,
                    },
                    { status: 503 },
                );
            }

            const selectedRole = roles.find((role) => role.id === incomingRoleId);

            if (!selectedRole) {
                return NextResponse.json(
                    {
                        error: "The selected role was not found on this server.",
                    },
                    { status: 400 },
                );
            }

            zooMemberRoleId = incomingRoleId;
            zooMemberRoleName = selectedRole.name;
        }
    }

    const saved = await prisma.guildConfiguration.upsert({
        where: { discordGuildId: resolved.guildId },
        update: {
            apiKey,
            channelId,
            enableSecondRoster,
            zooMemberRoleId,
            zooMemberRoleName,
            warsCount,
            racesCount,
            invasionsCount,
            vodsCount,
            reviewsCount,
            bonusCount,
        },
        create: {
            discordGuildId: resolved.guildId,
            apiKey,
            channelId,
            enableSecondRoster,
            zooMemberRoleId,
            zooMemberRoleName,
            warsCount,
            racesCount,
            invasionsCount,
            vodsCount,
            reviewsCount,
            bonusCount,
        },
        select: {
            apiKey: true,
            channelId: true,
            enableSecondRoster: true,
            zooMemberRoleId: true,
            zooMemberRoleName: true,
            warsCount: true,
            racesCount: true,
            invasionsCount: true,
            vodsCount: true,
            reviewsCount: true,
            bonusCount: true,
            updatedAt: true,
        },
    });

    const { roles, rolesError } = await getDiscordGuildRoles(resolved.guildId);

    return NextResponse.json({
        guild: {
            id: resolved.guildId,
            name: resolved.guildName,
        },
        roles,
        rolesError,
        configuration: {
            apiKey: saved.apiKey ?? "",
            channelId: saved.channelId ?? "",
            enableSecondRoster: saved.enableSecondRoster,
            zooMemberRoleId: saved.zooMemberRoleId ?? "",
            zooMemberRoleName: saved.zooMemberRoleName ?? "",
            warsCount: saved.warsCount,
            racesCount: saved.racesCount,
            invasionsCount: saved.invasionsCount,
            vodsCount: saved.vodsCount,
            reviewsCount: saved.reviewsCount,
            bonusCount: saved.bonusCount,
            updatedAt: saved.updatedAt,
        },
    });
}
