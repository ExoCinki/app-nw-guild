import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishLiveUpdate } from "@/lib/live-updates";
import { apiHandler, requireAuth, requireGuildAuth } from "@/lib/route-guard";
import { resolveRosterSession } from "@/lib/roster-session";

export const dynamic = "force-dynamic";

function normalizePlayerNameKey(value: string) {
    return value.trim().toLowerCase();
}

type RosterSourceSession = {
    id: string;
    name: string | null;
    status: string;
    isLocked: boolean;
    createdAt: Date;
    updatedAt: Date;
};

function mapRosterSessionSummary(session: RosterSourceSession) {
    return {
        id: session.id,
        name: session.name,
        status: session.status,
        isLocked: session.isLocked,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
    };
}

export const GET = apiHandler("GET /api/scoreboard/import-roster", async (request: NextRequest) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const guild = await requireGuildAuth(
        auth.email,
        request.nextUrl.searchParams.get("guildId"),
        "scoreboard",
    );
    if ("response" in guild) return guild.response;

    const rosterSessions = await prisma.roster.findMany({
        where: { discordGuildId: guild.resolved.guildId },
        select: {
            id: true,
            name: true,
            status: true,
            isLocked: true,
            createdAt: true,
            updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
    });

    if (rosterSessions.length === 0) {
        return NextResponse.json({
            sessions: [],
            selectedRosterSessionId: null,
            roster: null,
        });
    }

    const scoreboardSessionId = request.nextUrl.searchParams.get("scoreboardSessionId")?.trim() ?? null;
    const requestedRosterSessionId = request.nextUrl.searchParams.get("rosterSessionId")?.trim() ?? null;

    let persistedSelectionId: string | null = null;

    if (scoreboardSessionId) {
        const scoreboardSession = await prisma.scoreboardSession.findFirst({
            where: {
                id: scoreboardSessionId,
                discordGuildId: guild.resolved.guildId,
            },
            select: { id: true },
        });

        if (scoreboardSession) {
            const persistedSelection = await prisma.scoreboardSelectedRosterSession.findUnique({
                where: {
                    userId_discordGuildId_scoreboardSessionId: {
                        userId: guild.resolved.userId,
                        discordGuildId: guild.resolved.guildId,
                        scoreboardSessionId,
                    },
                },
                select: { rosterId: true },
            });

            persistedSelectionId = persistedSelection?.rosterId ?? null;
        }
    }

    const selectedRosterSession =
        rosterSessions.find((session) => session.id === requestedRosterSessionId) ??
        rosterSessions.find((session) => session.id === persistedSelectionId) ??
        rosterSessions[0];

    const roster = await prisma.roster.findFirst({
        where: {
            id: selectedRosterSession.id,
            discordGuildId: guild.resolved.guildId,
        },
        select: {
            id: true,
            name: true,
            groups: {
                select: {
                    id: true,
                    rosterIndex: true,
                    groupNumber: true,
                    name: true,
                    slots: {
                        select: {
                            id: true,
                            position: true,
                            playerName: true,
                        },
                        orderBy: { position: "asc" },
                    },
                },
                orderBy: [{ rosterIndex: "asc" }, { groupNumber: "asc" }],
            },
        },
    });

    return NextResponse.json({
        sessions: rosterSessions.map(mapRosterSessionSummary),
        selectedRosterSessionId: selectedRosterSession.id,
        roster,
    });
});

export const PATCH = apiHandler("PATCH /api/scoreboard/import-roster", async (request: NextRequest) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const payload = (await request.json()) as {
        scoreboardSessionId?: string;
        rosterSessionId?: string;
        guildId?: string;
    };

    const scoreboardSessionId = payload.scoreboardSessionId?.trim();
    const rosterSessionId = payload.rosterSessionId?.trim();

    if (!scoreboardSessionId) {
        return NextResponse.json({ error: "scoreboardSessionId is required" }, { status: 400 });
    }

    if (!rosterSessionId) {
        return NextResponse.json({ error: "rosterSessionId is required" }, { status: 400 });
    }

    const guild = await requireGuildAuth(auth.email, payload.guildId, "scoreboard", "write");
    if ("response" in guild) return guild.response;

    const [scoreboardSession, rosterSession] = await Promise.all([
        prisma.scoreboardSession.findFirst({
            where: {
                id: scoreboardSessionId,
                discordGuildId: guild.resolved.guildId,
            },
            select: { id: true },
        }),
        prisma.roster.findFirst({
            where: {
                id: rosterSessionId,
                discordGuildId: guild.resolved.guildId,
            },
            select: { id: true },
        }),
    ]);

    if (!scoreboardSession) {
        return NextResponse.json({ error: "Scoreboard session not found" }, { status: 404 });
    }

    if (!rosterSession) {
        return NextResponse.json({ error: "Roster session not found" }, { status: 404 });
    }

    const selection = await prisma.scoreboardSelectedRosterSession.upsert({
        where: {
            userId_discordGuildId_scoreboardSessionId: {
                userId: guild.resolved.userId,
                discordGuildId: guild.resolved.guildId,
                scoreboardSessionId,
            },
        },
        update: {
            rosterId: rosterSession.id,
            selectedAt: new Date(),
        },
        create: {
            userId: guild.resolved.userId,
            discordGuildId: guild.resolved.guildId,
            scoreboardSessionId,
            rosterId: rosterSession.id,
        },
        select: {
            scoreboardSessionId: true,
            rosterId: true,
            selectedAt: true,
            updatedAt: true,
        },
    });

    return NextResponse.json(selection);
});

export const POST = apiHandler("POST /api/scoreboard/import-roster", async (request: NextRequest) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const payload = (await request.json()) as {
        sessionId: string;
        guildId?: string;
        rosterIndex?: 1 | 2 | "all";
        rosterSessionId?: string;
    };

    if (!payload.sessionId) {
        return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const guild = await requireGuildAuth(auth.email, payload.guildId, "scoreboard", "write");
    if ("response" in guild) return guild.response;

    const sessionExists = await prisma.scoreboardSession.findFirst({
        where: { id: payload.sessionId, discordGuildId: guild.resolved.guildId },
        select: { id: true },
    });

    if (!sessionExists) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const rosterSession = await resolveRosterSession({
        guildId: guild.resolved.guildId,
        userId: guild.resolved.userId,
        rosterSessionId: payload.rosterSessionId ?? null,
        createIfMissing: true,
    });

    if (!rosterSession) {
        return NextResponse.json({ error: "No roster session found" }, { status: 404 });
    }

    const roster = await prisma.roster.findFirst({
        where: { id: rosterSession.id, discordGuildId: guild.resolved.guildId },
        include: { groups: { include: { slots: true } } },
    });

    if (!roster) {
        return NextResponse.json({ error: "No roster found" }, { status: 404 });
    }

    const rosterIndex = payload.rosterIndex ?? "all";
    const selectedGroups = roster.groups.filter((group) =>
        rosterIndex === "all" ? true : group.rosterIndex === rosterIndex,
    );

    const playerNameMap = new Map<string, string>();

    for (const group of selectedGroups) {
        for (const slot of group.slots) {
            const playerName = slot.playerName?.trim();
            if (!playerName) continue;
            const key = normalizePlayerNameKey(playerName);
            if (!playerNameMap.has(key)) {
                playerNameMap.set(key, playerName);
            }
        }
    }

    const entries = await Promise.all(
        Array.from(playerNameMap.entries()).map(([playerNameKey, playerName]) =>
            prisma.scoreboardEntry.upsert({
                where: {
                    sessionId_playerNameKey: { sessionId: payload.sessionId, playerNameKey },
                },
                update: {},
                create: {
                    sessionId: payload.sessionId,
                    discordGuildId: guild.resolved.guildId,
                    playerName,
                    playerNameKey,
                },
            }),
        ),
    );

    if (entries.length > 0) {
        publishLiveUpdate({ topic: "scoreboard", guildId: guild.resolved.guildId });
    }

    return NextResponse.json({ entries, imported: entries.length });
});
