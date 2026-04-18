import type { ScoreTotals, ScoreboardEntry } from "./scoreboard-types";

export function normalizePlayerNameKey(value: string) {
    return value.trim().toLowerCase();
}

export function normalizeSearchText(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

export function createEmptyTotals(): ScoreTotals {
    return {
        kills: 0,
        deaths: 0,
        assists: 0,
        damageDealt: 0,
        healingDone: 0,
    };
}

export function addEntryToTotals(target: ScoreTotals, entry: ScoreboardEntry) {
    target.kills += entry.kills;
    target.deaths += entry.deaths;
    target.assists += entry.assists;
    target.damageDealt += entry.damageDealt;
    target.healingDone += entry.healingDone;
}
