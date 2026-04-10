import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, requireAuth, requireGuildAuth } from "@/lib/route-guard";

export const dynamic = "force-dynamic";

type PlayerStats = {
    playerName: string;
    sessionsPlayed: number;
    kills: number;
    deaths: number;
    assists: number;
    damageDealt: number;
    healingDone: number;
    updatedAt: string;
};

export const GET = apiHandler("GET /api/scoreboard/history", async (request: NextRequest) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const guild = await requireGuildAuth(auth.email, request.nextUrl.searchParams.get("guildId"), "scoreboard");
    if ("response" in guild) return guild.response;

    const entries = await prisma.scoreboardEntry.findMany({
        where: { discordGuildId: guild.resolved.guildId },
        select: {
            playerName: true,
            playerNameKey: true,
            sessionId: true,
            kills: true,
            deaths: true,
            assists: true,
            damageDealt: true,
            healingDone: true,
            updatedAt: true,
        },
    });

    type Acc = {
        playerName: string;
        sessions: Set<string>;
        kills: number;
        deaths: number;
        assists: number;
        damageDealt: number;
        healingDone: number;
        updatedAtMs: number;
    };

    const byPlayer = new Map<string, Acc>();

    for (const entry of entries) {
        const existing = byPlayer.get(entry.playerNameKey);
        const updatedAtMs = entry.updatedAt.getTime();

        if (!existing) {
            byPlayer.set(entry.playerNameKey, {
                playerName: entry.playerName,
                sessions: new Set([entry.sessionId]),
                kills: entry.kills,
                deaths: entry.deaths,
                assists: entry.assists,
                damageDealt: entry.damageDealt,
                healingDone: entry.healingDone,
                updatedAtMs,
            });
            continue;
        }

        existing.sessions.add(entry.sessionId);
        existing.kills += entry.kills;
        existing.deaths += entry.deaths;
        existing.assists += entry.assists;
        existing.damageDealt += entry.damageDealt;
        existing.healingDone += entry.healingDone;
        if (updatedAtMs > existing.updatedAtMs) {
            existing.updatedAtMs = updatedAtMs;
            existing.playerName = entry.playerName;
        }
    }

    const players: PlayerStats[] = Array.from(byPlayer.values())
        .map((v) => ({
            playerName: v.playerName,
            sessionsPlayed: v.sessions.size,
            kills: v.kills,
            deaths: v.deaths,
            assists: v.assists,
            damageDealt: v.damageDealt,
            healingDone: v.healingDone,
            updatedAt: new Date(v.updatedAtMs).toISOString(),
        }))
        .sort((a, b) => b.kills - a.kills || b.assists - a.assists);

    return NextResponse.json({ players });
});
