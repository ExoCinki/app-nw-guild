import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminGuardStatus } from "@/lib/admin-access";
import { withApiTiming } from "@/lib/api-timing";

export const dynamic = "force-dynamic";

type DiscordRole = {
    id: string;
    name: string;
    position: number;
};

const preferredBotTokenByGuild = new Map<string, string>();

function getDiscordBotTokens(): string[] {
    const multi = (process.env.DISCORD_BOT_TOKENS ?? "")
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);
    const single = (process.env.DISCORD_BOT_TOKEN ?? "").trim();

    return [...new Set([...multi, ...(single ? [single] : [])])];
}

function ownerGuardResponse(status: "unauthorized" | "forbidden" | "misconfigured") {
    if (status === "unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (status === "forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
        { error: "OWNER_DISCORD_ID is not configured" },
        { status: 500 },
    );
}

function parseNonNegativeInt(value: unknown, fieldName: string): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
        throw new Error(`${fieldName} must be a non-negative integer`);
    }

    return value;
}

async function getDiscordGuildRoles(guildId: string): Promise<{
    roles: DiscordRole[];
    rolesError: string | null;
}> {
    const tokens = getDiscordBotTokens();

    if (tokens.length === 0) {
        return {
            roles: [],
            rolesError: "DISCORD_BOT_TOKEN ou DISCORD_BOT_TOKENS manquant pour charger les roles.",
        };
    }

    const preferred = preferredBotTokenByGuild.get(guildId);
    const orderedTokens = preferred
        ? [preferred, ...tokens.filter((token) => token !== preferred)]
        : tokens;

    let lastStatus: number | null = null;

    for (const botToken of orderedTokens) {
        const response = await fetch(
            `https://discord.com/api/v10/guilds/${guildId}/roles`,
            {
                headers: {
                    Authorization: `Bot ${botToken}`,
                },
                cache: "no-store",
            },
        );

        lastStatus = response.status;

        if (!response.ok) {
            continue;
        }

        preferredBotTokenByGuild.set(guildId, botToken);

        const roles = (await response.json()) as Array<{
            id: string;
            name: string;
            position: number;
            managed?: boolean;
            tags?: {
                bot_id?: string;
                integration_id?: string;
            };
        }>;

        const filtered = roles
            .filter((role) => role.id !== guildId)
            .filter(
                (role) =>
                    !role.managed &&
                    !role.tags?.bot_id &&
                    !role.tags?.integration_id,
            )
            .sort((a, b) => b.position - a.position)
            .map((role) => ({
                id: role.id,
                name: role.name,
                position: role.position,
            }));

        return {
            roles: filtered,
            rolesError: null,
        };
    }

    return {
        roles: [],
        rolesError:
            lastStatus !== null
                ? `Unable to load Discord roles for this server (status ${lastStatus}).`
                : "Unable to load Discord roles for this server.",
    };
}

async function ensureWhitelistedGuild(guildId: string) {
    const guild = await prisma.whitelistedGuild.findUnique({
        where: { discordGuildId: guildId },
        select: { discordGuildId: true },
    });

    return Boolean(guild);
}

export async function GET(request: NextRequest) {
    const adminStatus = await getAdminGuardStatus();
    if (adminStatus.status !== "ok") {
        return ownerGuardResponse(adminStatus.status);
    }

    const requestUrl = new URL(request.url);
    const requestType = requestUrl.searchParams.get("type");
    const guildId = requestUrl.searchParams.get("guildId")?.trim();

    if (requestType === "guild-roles") {
        if (!guildId) {
            return NextResponse.json({ error: "guildId is required" }, { status: 400 });
        }

        const guildExists = await ensureWhitelistedGuild(guildId);
        if (!guildExists) {
            return NextResponse.json({ error: "Guild is not whitelisted" }, { status: 404 });
        }

        const { roles, rolesError } = await withApiTiming(
            "GET /api/admin/global?type=guild-roles",
            () => getDiscordGuildRoles(guildId),
        );
        return NextResponse.json({ roles, rolesError });
    }

    const [guilds, users, accesses, bans, configurations, globalAdmins] = await withApiTiming(
        "GET /api/admin/global",
        () => Promise.all([
            prisma.whitelistedGuild.findMany({
                orderBy: { createdAt: "desc" },
                select: {
                    discordGuildId: true,
                    name: true,
                    createdAt: true,
                },
            }),
            prisma.user.findMany({
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    discordId: true,
                    displayName: true,
                    name: true,
                    email: true,
                    selectedGuild: {
                        select: {
                            discordGuildId: true,
                            discordGuildName: true,
                            selectedAt: true,
                        },
                    },
                    createdAt: true,
                },
            }),
            prisma.guildUserAccess.findMany({
                orderBy: { updatedAt: "desc" },
                select: {
                    userId: true,
                    discordGuildId: true,
                    canReadRoster: true,
                    canWriteRoster: true,
                    canReadPayout: true,
                    canWritePayout: true,
                    canReadScoreboard: true,
                    canWriteScoreboard: true,
                    canReadConfiguration: true,
                    canWriteConfiguration: true,
                    canReadArchives: true,
                    canWriteArchives: true,
                    updatedAt: true,
                },
            }),
            prisma.bannedDiscordUser.findMany({
                orderBy: { createdAt: "desc" },
                select: {
                    discordId: true,
                    reason: true,
                    createdAt: true,
                    bannedByUserId: true,
                },
            }),
            prisma.guildConfiguration.findMany({
                orderBy: { updatedAt: "desc" },
                select: {
                    discordGuildId: true,
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
            }),
            prisma.globalAdmin.findMany({
                orderBy: { createdAt: "desc" },
                select: {
                    userId: true,
                    createdAt: true,
                },
            }),
        ]),
    );

    return NextResponse.json({ guilds, users, accesses, bans, configurations, globalAdmins });
}

export async function PATCH(request: NextRequest) {
    const adminStatus = await getAdminGuardStatus();
    if (adminStatus.status !== "ok") {
        return ownerGuardResponse(adminStatus.status);
    }

    const payload = (await request.json().catch(() => null)) as
        | {
            type?: "set-access";
            userId?: string;
            guildId?: string;
            canReadRoster?: boolean;
            canWriteRoster?: boolean;
            canReadPayout?: boolean;
            canWritePayout?: boolean;
            canReadScoreboard?: boolean;
            canWriteScoreboard?: boolean;
            canReadConfiguration?: boolean;
            canWriteConfiguration?: boolean;
            canReadArchives?: boolean;
            canWriteArchives?: boolean;
        }
        | {
            type?: "remove-access";
            userId?: string;
            guildId?: string;
        }
        | {
            type?: "set-config";
            guildId?: string;
            apiKey?: string;
            channelId?: string;
            enableSecondRoster?: boolean;
            zooMemberRoleId?: string;
            zooMemberRoleName?: string;
            warsCount?: number;
            racesCount?: number;
            invasionsCount?: number;
            vodsCount?: number;
            reviewsCount?: number;
            bonusCount?: number;
        }
        | {
            type?: "set-user";
            userId?: string;
            displayName?: string;
            selectedGuildId?: string | null;
        }
        | {
            type?: "add-global-admin" | "remove-global-admin";
            userId?: string;
        }
        | null;

    if (!payload?.type) {
        return NextResponse.json({ error: "type is required" }, { status: 400 });
    }

    if (payload.type === "set-access") {
        const userId = payload.userId?.trim();
        const guildId = payload.guildId?.trim();

        const normalizedCanWriteRoster = payload.canWriteRoster ?? true;
        const normalizedCanReadRoster = (payload.canReadRoster ?? true) || normalizedCanWriteRoster;
        const normalizedCanWritePayout = payload.canWritePayout ?? true;
        const normalizedCanReadPayout = (payload.canReadPayout ?? true) || normalizedCanWritePayout;
        const normalizedCanWriteScoreboard = payload.canWriteScoreboard ?? true;
        const normalizedCanReadScoreboard =
            (payload.canReadScoreboard ?? true) || normalizedCanWriteScoreboard;
        const normalizedCanWriteConfiguration = payload.canWriteConfiguration ?? true;
        const normalizedCanReadConfiguration =
            (payload.canReadConfiguration ?? true) || normalizedCanWriteConfiguration;
        const normalizedCanWriteArchives = payload.canWriteArchives ?? true;
        const normalizedCanReadArchives = (payload.canReadArchives ?? true) || normalizedCanWriteArchives;

        if (!userId || !guildId) {
            return NextResponse.json(
                { error: "userId and guildId are required" },
                { status: 400 },
            );
        }

        const guildExists = await ensureWhitelistedGuild(guildId);
        if (!guildExists) {
            return NextResponse.json(
                { error: "Guild is not whitelisted" },
                { status: 404 },
            );
        }

        const access = await prisma.guildUserAccess.upsert({
            where: {
                userId_discordGuildId: {
                    userId,
                    discordGuildId: guildId,
                },
            },
            update: {
                canReadRoster: normalizedCanReadRoster,
                canWriteRoster: normalizedCanWriteRoster,
                canReadPayout: normalizedCanReadPayout,
                canWritePayout: normalizedCanWritePayout,
                canReadScoreboard: normalizedCanReadScoreboard,
                canWriteScoreboard: normalizedCanWriteScoreboard,
                canReadConfiguration: normalizedCanReadConfiguration,
                canWriteConfiguration: normalizedCanWriteConfiguration,
                canReadArchives: normalizedCanReadArchives,
                canWriteArchives: normalizedCanWriteArchives,
            },
            create: {
                userId,
                discordGuildId: guildId,
                canReadRoster: normalizedCanReadRoster,
                canWriteRoster: normalizedCanWriteRoster,
                canReadPayout: normalizedCanReadPayout,
                canWritePayout: normalizedCanWritePayout,
                canReadScoreboard: normalizedCanReadScoreboard,
                canWriteScoreboard: normalizedCanWriteScoreboard,
                canReadConfiguration: normalizedCanReadConfiguration,
                canWriteConfiguration: normalizedCanWriteConfiguration,
                canReadArchives: normalizedCanReadArchives,
                canWriteArchives: normalizedCanWriteArchives,
            },
        });

        return NextResponse.json({ access });
    }

    if (payload.type === "remove-access") {
        const userId = payload.userId?.trim();
        const guildId = payload.guildId?.trim();

        if (!userId || !guildId) {
            return NextResponse.json(
                { error: "userId and guildId are required" },
                { status: 400 },
            );
        }

        await prisma.guildUserAccess.deleteMany({
            where: {
                userId,
                discordGuildId: guildId,
            },
        });

        return NextResponse.json({ ok: true });
    }

    if (payload.type === "set-user") {
        const userId = payload.userId?.trim();

        if (!userId) {
            return NextResponse.json({ error: "userId is required" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const nextDisplayName = (payload.displayName ?? "").trim() || null;

        await prisma.user.update({
            where: { id: userId },
            data: { displayName: nextDisplayName },
        });

        const selectedGuildId = payload.selectedGuildId?.trim() ?? null;

        if (selectedGuildId) {
            const guild = await prisma.whitelistedGuild.findUnique({
                where: { discordGuildId: selectedGuildId },
                select: { discordGuildId: true, name: true },
            });

            if (!guild) {
                return NextResponse.json(
                    { error: "Selected guild is not whitelisted" },
                    { status: 404 },
                );
            }

            await prisma.selectedGuild.upsert({
                where: { userId },
                update: {
                    discordGuildId: guild.discordGuildId,
                    discordGuildName: guild.name,
                    discordGuildIconUrl: null,
                },
                create: {
                    userId,
                    discordGuildId: guild.discordGuildId,
                    discordGuildName: guild.name,
                    discordGuildIconUrl: null,
                },
            });
        } else {
            await prisma.selectedGuild.deleteMany({ where: { userId } });
        }

        const updatedUser = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                discordId: true,
                displayName: true,
                name: true,
                email: true,
                selectedGuild: {
                    select: {
                        discordGuildId: true,
                        discordGuildName: true,
                        selectedAt: true,
                    },
                },
                createdAt: true,
            },
        });

        return NextResponse.json({ user: updatedUser });
    }

    if (payload.type === "add-global-admin" || payload.type === "remove-global-admin") {
        const userId = (payload as { type?: string; userId?: string }).userId?.trim();

        if (!userId) {
            return NextResponse.json({ error: "userId is required" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (payload.type === "add-global-admin") {
            await prisma.globalAdmin.upsert({
                where: { userId },
                update: {},
                create: { userId },
            });
        } else {
            await prisma.globalAdmin.deleteMany({ where: { userId } });
        }

        return NextResponse.json({ ok: true });
    }

    const configPayload = payload as {
        type?: "set-config";
        guildId?: string;
        apiKey?: string;
        channelId?: string;
        enableSecondRoster?: boolean;
        zooMemberRoleId?: string;
        zooMemberRoleName?: string;
        warsCount?: number;
        racesCount?: number;
        invasionsCount?: number;
        vodsCount?: number;
        reviewsCount?: number;
        bonusCount?: number;
    };

    const guildId = configPayload.guildId?.trim();

    if (!guildId) {
        return NextResponse.json({ error: "guildId is required" }, { status: 400 });
    }

    const guildExists = await ensureWhitelistedGuild(guildId);
    if (!guildExists) {
        return NextResponse.json({ error: "Guild is not whitelisted" }, { status: 404 });
    }

    const existing = await prisma.guildConfiguration.findUnique({
        where: { discordGuildId: guildId },
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

    let warsCount = existing?.warsCount ?? 0;
    let racesCount = existing?.racesCount ?? 0;
    let invasionsCount = existing?.invasionsCount ?? 0;
    let vodsCount = existing?.vodsCount ?? 0;
    let reviewsCount = existing?.reviewsCount ?? 0;
    let bonusCount = existing?.bonusCount ?? 0;

    const hasEnableSecondRoster = Object.prototype.hasOwnProperty.call(
        configPayload,
        "enableSecondRoster",
    );

    if (hasEnableSecondRoster && typeof configPayload.enableSecondRoster !== "boolean") {
        return NextResponse.json(
            { error: "enableSecondRoster must be a boolean" },
            { status: 400 },
        );
    }

    const enableSecondRoster = hasEnableSecondRoster
        ? (configPayload.enableSecondRoster as boolean)
        : (existing?.enableSecondRoster ?? false);

    try {
        if (Object.prototype.hasOwnProperty.call(configPayload, "warsCount")) {
            warsCount = parseNonNegativeInt(configPayload.warsCount, "warsCount");
        }
        if (Object.prototype.hasOwnProperty.call(configPayload, "racesCount")) {
            racesCount = parseNonNegativeInt(configPayload.racesCount, "racesCount");
        }
        if (Object.prototype.hasOwnProperty.call(configPayload, "invasionsCount")) {
            invasionsCount = parseNonNegativeInt(configPayload.invasionsCount, "invasionsCount");
        }
        if (Object.prototype.hasOwnProperty.call(configPayload, "vodsCount")) {
            vodsCount = parseNonNegativeInt(configPayload.vodsCount, "vodsCount");
        }
        if (Object.prototype.hasOwnProperty.call(configPayload, "reviewsCount")) {
            reviewsCount = parseNonNegativeInt(configPayload.reviewsCount, "reviewsCount");
        }
        if (Object.prototype.hasOwnProperty.call(configPayload, "bonusCount")) {
            bonusCount = parseNonNegativeInt(configPayload.bonusCount, "bonusCount");
        }
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Invalid numeric fields",
            },
            { status: 400 },
        );
    }

    let zooMemberRoleId = existing?.zooMemberRoleId ?? null;
    let zooMemberRoleName = existing?.zooMemberRoleName ?? null;

    if (Object.prototype.hasOwnProperty.call(configPayload, "zooMemberRoleId")) {
        const incomingRoleId = (configPayload.zooMemberRoleId ?? "").trim();

        if (!incomingRoleId) {
            zooMemberRoleId = null;
            zooMemberRoleName = null;
        } else {
            const { roles, rolesError } = await getDiscordGuildRoles(guildId);

            if (rolesError) {
                return NextResponse.json({ error: rolesError }, { status: 503 });
            }

            const selectedRole = roles.find((role) => role.id === incomingRoleId);

            if (!selectedRole) {
                return NextResponse.json(
                    { error: "The selected role was not found on this server." },
                    { status: 400 },
                );
            }

            zooMemberRoleId = incomingRoleId;
            zooMemberRoleName = selectedRole.name;
        }
    }

    const saved = await prisma.guildConfiguration.upsert({
        where: { discordGuildId: guildId },
        update: {
            ...(Object.prototype.hasOwnProperty.call(configPayload, "apiKey") && {
                apiKey: (configPayload.apiKey ?? "").trim() || null,
            }),
            ...(Object.prototype.hasOwnProperty.call(configPayload, "channelId") && {
                channelId: (configPayload.channelId ?? "").trim() || null,
            }),
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
            discordGuildId: guildId,
            apiKey: (configPayload.apiKey ?? "").trim() || null,
            channelId: (configPayload.channelId ?? "").trim() || null,
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
    });

    return NextResponse.json({ configuration: saved });
}

export async function POST(request: NextRequest) {
    const adminStatus = await getAdminGuardStatus();
    if (adminStatus.status !== "ok") {
        return ownerGuardResponse(adminStatus.status);
    }

    const payload = (await request.json().catch(() => null)) as {
        discordId?: string;
        reason?: string;
    } | null;

    const discordId = payload?.discordId?.trim();

    if (!discordId) {
        return NextResponse.json({ error: "discordId is required" }, { status: 400 });
    }

    const ban = await prisma.bannedDiscordUser.upsert({
        where: { discordId },
        update: {
            reason: payload?.reason?.trim() || null,
            bannedByUserId: adminStatus.session.user.id,
        },
        create: {
            discordId,
            reason: payload?.reason?.trim() || null,
            bannedByUserId: adminStatus.session.user.id,
        },
        select: {
            discordId: true,
            reason: true,
            createdAt: true,
            bannedByUserId: true,
        },
    });

    return NextResponse.json({ ban });
}

export async function DELETE(request: NextRequest) {
    const adminStatus = await getAdminGuardStatus();
    if (adminStatus.status !== "ok") {
        return ownerGuardResponse(adminStatus.status);
    }

    const discordId = request.nextUrl.searchParams.get("discordId")?.trim();

    if (!discordId) {
        return NextResponse.json({ error: "discordId is required" }, { status: 400 });
    }

    await prisma.bannedDiscordUser.deleteMany({ where: { discordId } });

    return NextResponse.json({ success: true });
}
