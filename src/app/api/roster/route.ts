import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";
import { publishLiveUpdate } from "@/lib/live-updates";

export const dynamic = "force-dynamic";

const GROUP_COUNT = 10;
const SLOT_COUNT = 5;

async function resolveGuildForUser(email: string, guildIdFromQuery: string | null) {
    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
    });

    if (!user) {
        return { error: "User not found", status: 404 as const };
    }

    const manageableGuildsResult = await getManagedWhitelistedGuilds(email);

    if (!manageableGuildsResult.ok) {
        return { error: manageableGuildsResult.error, status: manageableGuildsResult.status };
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
        return { error: "Guild is not manageable for this account", status: 403 as const };
    }

    const guildName =
        manageableGuilds.find((guild) => guild.id === guildId)?.name ?? null;

    return { userId: user.id, guildId, guildName };
}

function buildNormalizedRoster(dbRoster: {
    selectedEventId?: string | null;
    groups: Array<{
        groupNumber: number;
        name: string | null;
        slots: Array<{
            position: number;
            playerName: string | null;
            role: string | null;
        }>;
    }>;
} | null) {
    return Array.from({ length: GROUP_COUNT }, (_, i) => {
        const groupNumber = i + 1;
        const dbGroup = dbRoster?.groups.find((g) => g.groupNumber === groupNumber);
        return {
            groupNumber,
            name: dbGroup?.name ?? null,
            slots: Array.from({ length: SLOT_COUNT }, (__, j) => {
                const position = j + 1;
                const dbSlot = dbGroup?.slots.find((s) => s.position === position);
                return {
                    position,
                    playerName: dbSlot?.playerName ?? null,
                    role: dbSlot?.role ?? null,
                };
            }),
        };
    });
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

    const dbRoster = await prisma.roster.findUnique({
        where: { discordGuildId: resolved.guildId },
        select: {
            selectedEventId: true,
            groups: {
                select: {
                    groupNumber: true,
                    name: true,
                    slots: {
                        select: { position: true, playerName: true, role: true },
                    },
                },
            },
        },
    });

    return NextResponse.json({
        guild: { id: resolved.guildId, name: resolved.guildName },
        roster: {
            selectedEventId: dbRoster?.selectedEventId ?? null,
            groups: buildNormalizedRoster(dbRoster),
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
        groupNumber: number;
        name?: string | null;
        slots: Array<{
            position: number;
            playerName: string | null;
            role: string | null;
        }>;
    };

    if (
        !Number.isInteger(payload.groupNumber) ||
        payload.groupNumber < 1 ||
        payload.groupNumber > GROUP_COUNT
    ) {
        return NextResponse.json(
            { error: "groupNumber must be between 1 and 10" },
            { status: 400 },
        );
    }

    if (
        !Array.isArray(payload.slots) ||
        payload.slots.length !== SLOT_COUNT
    ) {
        return NextResponse.json(
            { error: `slots must contain exactly ${SLOT_COUNT} entries` },
            { status: 400 },
        );
    }

    const resolved = await resolveGuildForUser(
        session.user.email,
        payload.guildId ?? null,
    );

    if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    // Upsert roster
    const roster = await prisma.roster.upsert({
        where: { discordGuildId: resolved.guildId },
        create: { discordGuildId: resolved.guildId },
        update: {},
        select: { id: true },
    });

    // Upsert group
    const group = await prisma.rosterGroup.upsert({
        where: {
            rosterId_groupNumber: {
                rosterId: roster.id,
                groupNumber: payload.groupNumber,
            },
        },
        create: {
            rosterId: roster.id,
            groupNumber: payload.groupNumber,
            name: (payload.name ?? "").trim() || null,
        },
        update: {
            name: (payload.name ?? "").trim() || null,
        },
        select: { id: true },
    });

    // Upsert all slots
    await Promise.all(
        payload.slots.map((slot) =>
            prisma.rosterSlot.upsert({
                where: {
                    groupId_position: {
                        groupId: group.id,
                        position: slot.position,
                    },
                },
                create: {
                    groupId: group.id,
                    position: slot.position,
                    playerName: slot.playerName?.trim() || null,
                    role: slot.playerName?.trim() ? slot.role || null : null,
                },
                update: {
                    playerName: slot.playerName?.trim() || null,
                    role: slot.playerName?.trim() ? slot.role || null : null,
                },
            }),
        ),
    );

    // Return full updated roster
    const dbRoster = await prisma.roster.findUnique({
        where: { discordGuildId: resolved.guildId },
        select: {
            selectedEventId: true,
            groups: {
                select: {
                    groupNumber: true,
                    name: true,
                    slots: {
                        select: { position: true, playerName: true, role: true },
                    },
                },
            },
        },
    });

    publishLiveUpdate({ topic: "roster", guildId: resolved.guildId });

    return NextResponse.json({
        guild: { id: resolved.guildId, name: resolved.guildName },
        roster: {
            selectedEventId: dbRoster?.selectedEventId ?? null,
            groups: buildNormalizedRoster(dbRoster),
        },
    });
}

export async function PATCH(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as {
        guildId?: string;
        selectedEventId?: string | null;
    };

    const resolved = await resolveGuildForUser(
        session.user.email,
        payload.guildId ?? null,
    );

    if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const roster = await prisma.roster.upsert({
        where: { discordGuildId: resolved.guildId },
        create: {
            discordGuildId: resolved.guildId,
            selectedEventId: (payload.selectedEventId ?? "").trim() || null,
        },
        update: {
            selectedEventId: (payload.selectedEventId ?? "").trim() || null,
        },
        select: {
            selectedEventId: true,
            groups: {
                select: {
                    groupNumber: true,
                    name: true,
                    slots: {
                        select: { position: true, playerName: true, role: true },
                    },
                },
            },
        },
    });

    publishLiveUpdate({ topic: "roster", guildId: resolved.guildId });

    return NextResponse.json({
        guild: { id: resolved.guildId, name: resolved.guildName },
        roster: {
            selectedEventId: roster.selectedEventId ?? null,
            groups: buildNormalizedRoster(roster),
        },
    });
}

export async function DELETE(request: Request) {
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

    // Vide tous les slots (playerName + role) sans supprimer les groupes
    await prisma.rosterSlot.updateMany({
        where: {
            group: {
                roster: { discordGuildId: resolved.guildId },
            },
        },
        data: { playerName: null, role: null },
    });

    const dbRoster = await prisma.roster.findUnique({
        where: { discordGuildId: resolved.guildId },
        select: {
            selectedEventId: true,
            groups: {
                select: {
                    groupNumber: true,
                    name: true,
                    slots: {
                        select: { position: true, playerName: true, role: true },
                    },
                },
            },
        },
    });

    publishLiveUpdate({ topic: "roster", guildId: resolved.guildId });

    return NextResponse.json({
        guild: { id: resolved.guildId, name: resolved.guildName },
        roster: {
            selectedEventId: dbRoster?.selectedEventId ?? null,
            groups: buildNormalizedRoster(dbRoster ?? null),
        },
    });
}
