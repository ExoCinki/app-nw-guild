import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerGuardStatus } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

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

async function ensureWhitelistedGuild(guildId: string) {
    const guild = await prisma.whitelistedGuild.findUnique({
        where: { discordGuildId: guildId },
        select: { discordGuildId: true },
    });

    return Boolean(guild);
}

export async function GET() {
    const ownerStatus = await getOwnerGuardStatus();
    if (ownerStatus.status !== "ok") {
        return ownerGuardResponse(ownerStatus.status);
    }

    const [guilds, users, accesses, bans, configurations] = await Promise.all([
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
                canReadConfiguration: true,
                canWriteConfiguration: true,
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
    ]);

    return NextResponse.json({ guilds, users, accesses, bans, configurations });
}

export async function PATCH(request: NextRequest) {
    const ownerStatus = await getOwnerGuardStatus();
    if (ownerStatus.status !== "ok") {
        return ownerGuardResponse(ownerStatus.status);
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
            canReadConfiguration?: boolean;
            canWriteConfiguration?: boolean;
        }
        | {
            type?: "set-config";
            guildId?: string;
            apiKey?: string;
            channelId?: string;
            zooMemberRoleId?: string;
            zooMemberRoleName?: string;
            warsCount?: number;
            racesCount?: number;
            invasionsCount?: number;
            vodsCount?: number;
            reviewsCount?: number;
            bonusCount?: number;
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
        const normalizedCanWriteConfiguration = payload.canWriteConfiguration ?? true;
        const normalizedCanReadConfiguration =
            (payload.canReadConfiguration ?? true) || normalizedCanWriteConfiguration;

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
                canReadConfiguration: normalizedCanReadConfiguration,
                canWriteConfiguration: normalizedCanWriteConfiguration,
            },
            create: {
                userId,
                discordGuildId: guildId,
                canReadRoster: normalizedCanReadRoster,
                canWriteRoster: normalizedCanWriteRoster,
                canReadPayout: normalizedCanReadPayout,
                canWritePayout: normalizedCanWritePayout,
                canReadConfiguration: normalizedCanReadConfiguration,
                canWriteConfiguration: normalizedCanWriteConfiguration,
            },
        });

        return NextResponse.json({ access });
    }

    const configPayload = payload as {
        type?: "set-config";
        guildId?: string;
        apiKey?: string;
        channelId?: string;
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

    const saved = await prisma.guildConfiguration.upsert({
        where: { discordGuildId: guildId },
        update: {
            ...(Object.prototype.hasOwnProperty.call(configPayload, "apiKey") && {
                apiKey: (configPayload.apiKey ?? "").trim() || null,
            }),
            ...(Object.prototype.hasOwnProperty.call(configPayload, "channelId") && {
                channelId: (configPayload.channelId ?? "").trim() || null,
            }),
            ...(Object.prototype.hasOwnProperty.call(configPayload, "zooMemberRoleId") && {
                zooMemberRoleId: (configPayload.zooMemberRoleId ?? "").trim() || null,
            }),
            ...(Object.prototype.hasOwnProperty.call(configPayload, "zooMemberRoleName") && {
                zooMemberRoleName: (configPayload.zooMemberRoleName ?? "").trim() || null,
            }),
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
            zooMemberRoleId: (configPayload.zooMemberRoleId ?? "").trim() || null,
            zooMemberRoleName: (configPayload.zooMemberRoleName ?? "").trim() || null,
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
    const ownerStatus = await getOwnerGuardStatus();
    if (ownerStatus.status !== "ok") {
        return ownerGuardResponse(ownerStatus.status);
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
            bannedByUserId: ownerStatus.session.user.id,
        },
        create: {
            discordId,
            reason: payload?.reason?.trim() || null,
            bannedByUserId: ownerStatus.session.user.id,
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
    const ownerStatus = await getOwnerGuardStatus();
    if (ownerStatus.status !== "ok") {
        return ownerGuardResponse(ownerStatus.status);
    }

    const discordId = request.nextUrl.searchParams.get("discordId")?.trim();

    if (!discordId) {
        return NextResponse.json({ error: "discordId is required" }, { status: 400 });
    }

    await prisma.bannedDiscordUser.deleteMany({ where: { discordId } });

    return NextResponse.json({ success: true });
}
