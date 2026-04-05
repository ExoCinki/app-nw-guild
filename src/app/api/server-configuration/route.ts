import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";

export const dynamic = "force-dynamic";

function parseNonNegativeInt(value: unknown, fieldName: string): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
        throw new Error(`${fieldName} must be a non-negative integer`);
    }

    return value;
}

async function resolveGuildForUser(email: string, guildIdFromQuery: string | null) {
    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
    });

    if (!user) {
        return { error: "User not found", status: 404 as const };
    }

    const manageableGuilds = await getManagedWhitelistedGuilds(email);

    if (!manageableGuilds) {
        return { error: "No Discord token found", status: 401 as const };
    }

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
        return { error: "Guild is not manageable for this account", status: 403 as const };
    }

    const guildName = manageableGuilds.find((guild) => guild.id === guildId)?.name ?? null;

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

    const resolved = await resolveGuildForUser(session.user.email, requestedGuildId);

    if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const config = await prisma.guildConfiguration.findUnique({
        where: { discordGuildId: resolved.guildId },
        select: {
            apiKey: true,
            channelId: true,
            warsCount: true,
            racesCount: true,
            invasionsCount: true,
            vodsCount: true,
            reviewsCount: true,
            bonusCount: true,
            updatedAt: true,
        },
    });

    return NextResponse.json({
        guild: {
            id: resolved.guildId,
            name: resolved.guildName,
        },
        configuration: {
            apiKey: config?.apiKey ?? "",
            channelId: config?.channelId ?? "",
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
    );

    if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const apiKey = (payload.apiKey ?? "").trim();
    const channelId = (payload.channelId ?? "").trim();

    let warsCount = 0;
    let racesCount = 0;
    let invasionsCount = 0;
    let vodsCount = 0;
    let reviewsCount = 0;
    let bonusCount = 0;

    try {
        warsCount = parseNonNegativeInt(payload.warsCount, "warsCount");
        racesCount = parseNonNegativeInt(payload.racesCount, "racesCount");
        invasionsCount = parseNonNegativeInt(payload.invasionsCount, "invasionsCount");
        vodsCount = parseNonNegativeInt(payload.vodsCount, "vodsCount");
        reviewsCount = parseNonNegativeInt(payload.reviewsCount, "reviewsCount");
        bonusCount = parseNonNegativeInt(payload.bonusCount, "bonusCount");
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

    const saved = await prisma.guildConfiguration.upsert({
        where: { discordGuildId: resolved.guildId },
        update: {
            apiKey: apiKey || null,
            channelId: channelId || null,
            warsCount,
            racesCount,
            invasionsCount,
            vodsCount,
            reviewsCount,
            bonusCount,
        },
        create: {
            discordGuildId: resolved.guildId,
            apiKey: apiKey || null,
            channelId: channelId || null,
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
            warsCount: true,
            racesCount: true,
            invasionsCount: true,
            vodsCount: true,
            reviewsCount: true,
            bonusCount: true,
            updatedAt: true,
        },
    });

    return NextResponse.json({
        guild: {
            id: resolved.guildId,
            name: resolved.guildName,
        },
        configuration: {
            apiKey: saved.apiKey ?? "",
            channelId: saved.channelId ?? "",
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
