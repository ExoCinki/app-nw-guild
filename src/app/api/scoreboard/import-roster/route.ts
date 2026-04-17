import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishLiveUpdate } from "@/lib/live-updates";
import { apiHandler, requireAuth, requireGuildAuth } from "@/lib/route-guard";
import { resolveRosterSession } from "@/lib/roster-session";

export const dynamic = "force-dynamic";

function normalizePlayerNameKey(value: string) {
    return value.trim().toLowerCase();
}

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
