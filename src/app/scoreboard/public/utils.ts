import type { PlayerAggregate, PublicScoreboardSession } from "./types";

export function normalizePlayerNameKey(value: string): string {
    return value.trim().toLowerCase();
}

export function safeRatio(numerator: number, denominator: number): number {
    return numerator / Math.max(1, denominator);
}

export function parsePositiveInt(
    input: string | null,
    fallback: number,
): number {
    const parsed = Number.parseInt(input ?? "", 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return parsed;
}

/**
 * Agrège les stats de chaque joueur sur toutes les sessions fournies.
 * Fonction pure — peut être testée indépendamment du composant.
 */
export function buildPlayerAggregates(
    sessions: PublicScoreboardSession[],
): PlayerAggregate[] {
    type Accumulator = {
        playerName: string;
        sessionsPlayed: Set<string>;
        kills: number;
        deaths: number;
        assists: number;
        damageDealt: number;
        healingDone: number;
        latestUpdatedAtMs: number;
    };

    const byPlayer = new Map<string, Accumulator>();

    for (const session of sessions) {
        const sessionDateMs = new Date(session.createdAt).getTime();

        for (const entry of session.entries) {
            const key = normalizePlayerNameKey(entry.playerName);
            const existing = byPlayer.get(key);

            if (!existing) {
                byPlayer.set(key, {
                    playerName: entry.playerName,
                    sessionsPlayed: new Set([session.id]),
                    kills: entry.kills,
                    deaths: entry.deaths,
                    assists: entry.assists,
                    damageDealt: entry.damageDealt,
                    healingDone: entry.healingDone,
                    latestUpdatedAtMs: sessionDateMs,
                });
                continue;
            }

            existing.playerName = entry.playerName;
            existing.sessionsPlayed.add(session.id);
            existing.kills += entry.kills;
            existing.deaths += entry.deaths;
            existing.assists += entry.assists;
            existing.damageDealt += entry.damageDealt;
            existing.healingDone += entry.healingDone;
            if (sessionDateMs > existing.latestUpdatedAtMs) {
                existing.latestUpdatedAtMs = sessionDateMs;
            }
        }
    }

    return Array.from(byPlayer.entries()).map(([key, acc]) => ({
        key,
        playerName: acc.playerName,
        sessionsPlayed: acc.sessionsPlayed.size,
        kills: acc.kills,
        deaths: acc.deaths,
        assists: acc.assists,
        damageDealt: acc.damageDealt,
        healingDone: acc.healingDone,
        updatedAt: new Date(acc.latestUpdatedAtMs).toISOString(),
    }));
}
