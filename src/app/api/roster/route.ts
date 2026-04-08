import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";
import { hasGuildScopeAccess, type GuildAccessMode } from "@/lib/admin-access";
import { publishLiveUpdate } from "@/lib/live-updates";
import { withApiTiming } from "@/lib/api-timing";

export const dynamic = "force-dynamic";

const GROUP_COUNT = 10;
const SLOT_COUNT = 5;
const PRIMARY_ROSTER_INDEX = 1;
const SECONDARY_ROSTER_INDEX = 2;

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

    const ownerDiscordId = process.env.OWNER_DISCORD_ID;
    const isOwner = Boolean(
        ownerDiscordId && user.discordId && user.discordId === ownerDiscordId,
    );

    const canAccessRoster = await hasGuildScopeAccess({
        userId: user.id,
        discordGuildId: guildId,
        scope: "roster",
        mode,
        isOwner,
    });

    if (!canAccessRoster) {
        return { error: "Access denied for roster module on this server", status: 403 as const };
    }

    const guildName =
        manageableGuilds.find((guild) => guild.id === guildId)?.name ?? null;

    return { userId: user.id, guildId, guildName };
}

function buildNormalizedRoster(
    dbRoster: {
        selectedEventId?: string | null;
        groups: Array<{
            rosterIndex: number;
            groupNumber: number;
            name: string | null;
            slots: Array<{
                position: number;
                playerName: string | null;
                role: string | null;
            }>;
        }>;
    } | null,
    rosterIndex: number,
) {
    return Array.from({ length: GROUP_COUNT }, (_, i) => {
        const groupNumber = i + 1;
        const dbGroup = dbRoster?.groups.find(
            (g) => g.groupNumber === groupNumber && g.rosterIndex === rosterIndex,
        );
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

function normalizePlayerKey(value: string | null | undefined) {
    return value?.trim().toLowerCase() ?? "";
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

    const [dbRoster, guildConfiguration] = await withApiTiming(
        "GET /api/roster",
        () => Promise.all([
            prisma.roster.findUnique({
                where: { discordGuildId: resolved.guildId },
                select: {
                    selectedEventId: true,
                    groups: {
                        select: {
                            rosterIndex: true,
                            groupNumber: true,
                            name: true,
                            slots: {
                                select: { position: true, playerName: true, role: true },
                            },
                        },
                    },
                },
            }),
            prisma.guildConfiguration.findUnique({
                where: { discordGuildId: resolved.guildId },
                select: { enableSecondRoster: true },
            }),
        ]),
    );

    const enableSecondRoster = guildConfiguration?.enableSecondRoster ?? false;

    return NextResponse.json({
        guild: { id: resolved.guildId, name: resolved.guildName },
        roster: {
            selectedEventId: dbRoster?.selectedEventId ?? null,
            enableSecondRoster,
            groups: buildNormalizedRoster(dbRoster, PRIMARY_ROSTER_INDEX),
            secondGroups: enableSecondRoster
                ? buildNormalizedRoster(dbRoster, SECONDARY_ROSTER_INDEX)
                : [],
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
        rosterIndex?: number;
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
        "write",
    );

    if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const rosterIndex = payload.rosterIndex ?? PRIMARY_ROSTER_INDEX;

    if (rosterIndex !== PRIMARY_ROSTER_INDEX && rosterIndex !== SECONDARY_ROSTER_INDEX) {
        return NextResponse.json(
            { error: "rosterIndex must be either 1 or 2" },
            { status: 400 },
        );
    }

    const guildConfiguration = await prisma.guildConfiguration.findUnique({
        where: { discordGuildId: resolved.guildId },
        select: { enableSecondRoster: true },
    });

    const enableSecondRoster = guildConfiguration?.enableSecondRoster ?? false;

    if (rosterIndex === SECONDARY_ROSTER_INDEX && !enableSecondRoster) {
        return NextResponse.json(
            { error: "Second roster is not enabled for this server" },
            { status: 400 },
        );
    }

    // Upsert roster
    const roster = await prisma.roster.upsert({
        where: { discordGuildId: resolved.guildId },
        create: { discordGuildId: resolved.guildId },
        update: {},
        select: { id: true },
    });

    const otherRosterIndex =
        rosterIndex === PRIMARY_ROSTER_INDEX
            ? SECONDARY_ROSTER_INDEX
            : PRIMARY_ROSTER_INDEX;

    const otherRosterGroups = await withApiTiming(
        "POST /api/roster conflict-check",
        () => prisma.rosterGroup.findMany({
            where: {
                rosterId: roster.id,
                rosterIndex: otherRosterIndex,
            },
            select: {
                slots: {
                    select: {
                        playerName: true,
                    },
                },
            },
        }),
    );

    const otherRosterPlayerKeys = new Set(
        otherRosterGroups
            .flatMap((group) => group.slots)
            .map((slot) => normalizePlayerKey(slot.playerName))
            .filter(Boolean),
    );

    const conflictingPlayers = Array.from(
        new Set(
            payload.slots
                .map((slot) => slot.playerName?.trim() ?? "")
                .filter((name) => name.length > 0)
                .filter((name) => otherRosterPlayerKeys.has(normalizePlayerKey(name))),
        ),
    );

    if (conflictingPlayers.length > 0) {
        return NextResponse.json(
            {
                error: `These players are already used in roster ${otherRosterIndex}: ${conflictingPlayers.join(", ")}`,
            },
            { status: 400 },
        );
    }

    // Upsert group
    const group = await prisma.rosterGroup.upsert({
        where: {
            rosterId_rosterIndex_groupNumber: {
                rosterId: roster.id,
                rosterIndex,
                groupNumber: payload.groupNumber,
            },
        },
        create: {
            rosterId: roster.id,
            rosterIndex,
            groupNumber: payload.groupNumber,
            name: (payload.name ?? "").trim() || null,
        },
        update: {
            name: (payload.name ?? "").trim() || null,
        },
        select: { id: true },
    });

    // Upsert all slots
    await withApiTiming("POST /api/roster slots-upsert", () =>
        Promise.all(
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
        ),
    );

    // Return full updated roster
    const dbRoster = await withApiTiming("POST /api/roster reload", () =>
        prisma.roster.findUnique({
            where: { discordGuildId: resolved.guildId },
            select: {
                selectedEventId: true,
                groups: {
                    select: {
                        rosterIndex: true,
                        groupNumber: true,
                        name: true,
                        slots: {
                            select: { position: true, playerName: true, role: true },
                        },
                    },
                },
            },
        }),
    );

    publishLiveUpdate({ topic: "roster", guildId: resolved.guildId });

    return NextResponse.json({
        guild: { id: resolved.guildId, name: resolved.guildName },
        roster: {
            selectedEventId: dbRoster?.selectedEventId ?? null,
            enableSecondRoster,
            groups: buildNormalizedRoster(dbRoster, PRIMARY_ROSTER_INDEX),
            secondGroups: enableSecondRoster
                ? buildNormalizedRoster(dbRoster, SECONDARY_ROSTER_INDEX)
                : [],
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
        "write",
    );

    if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const roster = await withApiTiming("PATCH /api/roster", () =>
        prisma.roster.upsert({
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
                        rosterIndex: true,
                        groupNumber: true,
                        name: true,
                        slots: {
                            select: { position: true, playerName: true, role: true },
                        },
                    },
                },
            },
        }),
    );

    const guildConfiguration = await prisma.guildConfiguration.findUnique({
        where: { discordGuildId: resolved.guildId },
        select: { enableSecondRoster: true },
    });

    const enableSecondRoster = guildConfiguration?.enableSecondRoster ?? false;

    publishLiveUpdate({ topic: "roster", guildId: resolved.guildId });

    return NextResponse.json({
        guild: { id: resolved.guildId, name: resolved.guildName },
        roster: {
            selectedEventId: roster.selectedEventId ?? null,
            enableSecondRoster,
            groups: buildNormalizedRoster(roster, PRIMARY_ROSTER_INDEX),
            secondGroups: enableSecondRoster
                ? buildNormalizedRoster(roster, SECONDARY_ROSTER_INDEX)
                : [],
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

    const resolved = await resolveGuildForUser(session.user.email, requestedGuildId, "write");

    if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    // Vide tous les slots (playerName + role) sans supprimer les groupes
    await withApiTiming("DELETE /api/roster clear-slots", () =>
        prisma.rosterSlot.updateMany({
            where: {
                group: {
                    roster: { discordGuildId: resolved.guildId },
                },
            },
            data: { playerName: null, role: null },
        }),
    );

    const [dbRoster, guildConfiguration] = await withApiTiming(
        "DELETE /api/roster reload",
        () => Promise.all([
            prisma.roster.findUnique({
                where: { discordGuildId: resolved.guildId },
                select: {
                    selectedEventId: true,
                    groups: {
                        select: {
                            rosterIndex: true,
                            groupNumber: true,
                            name: true,
                            slots: {
                                select: { position: true, playerName: true, role: true },
                            },
                        },
                    },
                },
            }),
            prisma.guildConfiguration.findUnique({
                where: { discordGuildId: resolved.guildId },
                select: { enableSecondRoster: true },
            }),
        ]),
    );

    const enableSecondRoster = guildConfiguration?.enableSecondRoster ?? false;

    publishLiveUpdate({ topic: "roster", guildId: resolved.guildId });

    return NextResponse.json({
        guild: { id: resolved.guildId, name: resolved.guildName },
        roster: {
            selectedEventId: dbRoster?.selectedEventId ?? null,
            enableSecondRoster,
            groups: buildNormalizedRoster(dbRoster ?? null, PRIMARY_ROSTER_INDEX),
            secondGroups: enableSecondRoster
                ? buildNormalizedRoster(dbRoster ?? null, SECONDARY_ROSTER_INDEX)
                : [],
        },
    });
}
