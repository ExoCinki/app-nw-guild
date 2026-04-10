import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PublicPlayerHistory = {
    playerName: string;
    sessionsPlayed: number;
    kills: number;
    deaths: number;
    assists: number;
    damageDealt: number;
    healingDone: number;
    updatedAt: string;
};

export async function GET(request: NextRequest) {
    try {
        const guildId = request.nextUrl.searchParams.get("guildId")?.trim() ?? null;

        const sessions = await prisma.scoreboardSession.findMany({
            where: guildId ? { discordGuildId: guildId } : undefined,
            include: {
                entries: {
                    orderBy: [
                        { kills: "desc" },
                        { assists: "desc" },
                        { playerName: "asc" },
                    ],
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            take: 200,
        });

        const guildIds = Array.from(new Set(sessions.map((session) => session.discordGuildId)));

        const guilds = guildIds.length
            ? await prisma.whitelistedGuild.findMany({
                where: {
                    discordGuildId: {
                        in: guildIds,
                    },
                },
                select: {
                    discordGuildId: true,
                    name: true,
                },
            })
            : [];

        const guildNameById = new Map(guilds.map((guild) => [guild.discordGuildId, guild.name]));

        const normalizedSessions = sessions.map((session) => ({
            ...session,
            guildName: guildNameById.get(session.discordGuildId) ?? null,
        }));

        const byPlayer = new Map<
            string,
            {
                playerName: string;
                sessions: Set<string>;
                kills: number;
                deaths: number;
                assists: number;
                damageDealt: number;
                healingDone: number;
                updatedAtMs: number;
            }
        >();

        for (const session of sessions) {
            for (const entry of session.entries) {
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
        }

        const players: PublicPlayerHistory[] = Array.from(byPlayer.values())
            .map((value) => ({
                playerName: value.playerName,
                sessionsPlayed: value.sessions.size,
                kills: value.kills,
                deaths: value.deaths,
                assists: value.assists,
                damageDealt: value.damageDealt,
                healingDone: value.healingDone,
                updatedAt: new Date(value.updatedAtMs).toISOString(),
            }))
            .sort((a, b) => b.kills - a.kills || b.assists - a.assists);

        return NextResponse.json({
            sessions: normalizedSessions,
            players,
        });
    } catch (error) {
        console.error("GET /api/scoreboard/public", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
