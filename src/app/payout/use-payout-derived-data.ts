import { useMemo } from "react";
import type {
    PayoutCalculations,
    PayoutEntry,
    PayoutGuildConfig,
    PayoutLiveEntry,
    PayoutRosterIndexSummary,
    PayoutRosterSourcePayload,
    PayoutSession,
    RosterSourceGroup,
} from "./payout-types";
import { PLAYERS_PER_PAGE } from "./payout-types";

function normalizePlayerNameKey(value: string) {
    return value.trim().toLowerCase();
}

export function usePayoutDerivedData({
    selectedSession,
    guildConfig,
    playerSearchQuery,
    currentPlayersPage,
    counterEdits,
    rosterSource,
}: {
    selectedSession: PayoutSession | undefined;
    guildConfig: PayoutGuildConfig | null | undefined;
    playerSearchQuery: string;
    currentPlayersPage: number;
    counterEdits: Record<string, Partial<PayoutEntry>>;
    rosterSource: PayoutRosterSourcePayload | undefined;
}) {
    const calculations = useMemo<PayoutCalculations | null>(() => {
        if (!selectedSession || !guildConfig) return null;

        const multipliers = {
            wars: guildConfig.warsCount || 1,
            races: guildConfig.racesCount || 1,
            reviews: guildConfig.reviewsCount || 1,
            bonus: guildConfig.bonusCount || 1,
            invasions: guildConfig.invasionsCount || 1,
            vods: guildConfig.vodsCount || 1,
        };

        const entries = selectedSession.entries.map((entry) => ({
            ...entry,
            points:
                entry.wars * multipliers.wars +
                entry.races * multipliers.races +
                entry.reviews * multipliers.reviews +
                entry.bonus * multipliers.bonus +
                entry.invasions * multipliers.invasions +
                entry.vods * multipliers.vods,
        }));

        const totalPoints = entries.reduce((sum, entry) => sum + entry.points, 0);
        const goldPerPoint =
            totalPoints > 0 ? selectedSession.goldPool / totalPoints : 0;

        return {
            entries,
            totalPoints,
            goldPerPoint,
            multipliers,
        };
    }, [selectedSession, guildConfig]);

    const filteredEntries = useMemo(() => {
        if (!calculations) return [];
        if (!playerSearchQuery.trim()) return calculations.entries;

        const query = playerSearchQuery.toLowerCase();
        return calculations.entries.filter((entry) => {
            const playerName = (entry.displayName || entry.username).toLowerCase();
            return playerName.includes(query);
        });
    }, [calculations, playerSearchQuery]);

    const liveEntries = useMemo<PayoutLiveEntry[]>(() => {
        if (!selectedSession || !calculations) {
            return [];
        }

        return selectedSession.entries.map((entry) => {
            const mergedEntry = { ...entry, ...(counterEdits[entry.id] || {}) };
            const points =
                mergedEntry.wars * calculations.multipliers.wars +
                mergedEntry.races * calculations.multipliers.races +
                mergedEntry.reviews * calculations.multipliers.reviews +
                mergedEntry.bonus * calculations.multipliers.bonus +
                mergedEntry.invasions * calculations.multipliers.invasions +
                mergedEntry.vods * calculations.multipliers.vods;

            return {
                ...mergedEntry,
                points,
                gold: points * calculations.goldPerPoint,
            };
        });
    }, [selectedSession, calculations, counterEdits]);

    const rosterSummaries = useMemo<PayoutRosterIndexSummary[]>(() => {
        const rosterGroups = rosterSource?.roster?.groups ?? [];
        if (!calculations || rosterGroups.length === 0) {
            return [];
        }

        const entryByPlayerName = new Map<string, PayoutLiveEntry>();

        for (const entry of liveEntries) {
            const possibleKeys = [entry.displayName, entry.username]
                .filter((value): value is string => Boolean(value?.trim()))
                .map((value) => normalizePlayerNameKey(value));

            for (const key of possibleKeys) {
                if (!entryByPlayerName.has(key)) {
                    entryByPlayerName.set(key, entry);
                }
            }
        }

        const groupedByRosterIndex = new Map<number, RosterSourceGroup[]>();
        for (const group of rosterGroups) {
            const currentGroups = groupedByRosterIndex.get(group.rosterIndex) ?? [];
            currentGroups.push(group);
            groupedByRosterIndex.set(group.rosterIndex, currentGroups);
        }

        return Array.from(groupedByRosterIndex.entries())
            .sort(([left], [right]) => left - right)
            .map(([rosterIndex, groups]) => {
                const globalPlayers = new Set<string>();
                const globalMatchedPlayers = new Set<string>();
                let globalPoints = 0;
                let globalGold = 0;

                const groupSummaries = groups.map((group) => {
                    let playersCount = 0;
                    let matchedPlayersCount = 0;
                    let totalPoints = 0;
                    let totalGold = 0;

                    for (const slot of group.slots) {
                        const playerName = slot.playerName?.trim();
                        if (!playerName) {
                            continue;
                        }

                        playersCount += 1;
                        const playerKey = normalizePlayerNameKey(playerName);
                        globalPlayers.add(playerKey);

                        const matchedEntry = entryByPlayerName.get(playerKey);
                        if (!matchedEntry) {
                            continue;
                        }

                        matchedPlayersCount += 1;
                        totalPoints += matchedEntry.points;
                        totalGold += matchedEntry.gold;

                        if (!globalMatchedPlayers.has(playerKey)) {
                            globalMatchedPlayers.add(playerKey);
                            globalPoints += matchedEntry.points;
                            globalGold += matchedEntry.gold;
                        }
                    }

                    return {
                        groupId: group.id,
                        groupNumber: group.groupNumber,
                        groupName: group.name,
                        playersCount,
                        matchedPlayersCount,
                        totalPoints,
                        totalGold,
                    };
                });

                return {
                    rosterIndex,
                    groups: groupSummaries,
                    global: {
                        playersCount: globalPlayers.size,
                        matchedPlayersCount: globalMatchedPlayers.size,
                        totalPoints: globalPoints,
                        totalGold: globalGold,
                    },
                };
            });
    }, [rosterSource, calculations, liveEntries]);

    const totalFilteredPlayers = filteredEntries.length;
    const totalPlayersPages = Math.max(
        1,
        Math.ceil(totalFilteredPlayers / PLAYERS_PER_PAGE),
    );

    const paginatedEntries = useMemo(() => {
        const start = (currentPlayersPage - 1) * PLAYERS_PER_PAGE;
        const end = start + PLAYERS_PER_PAGE;
        return filteredEntries.slice(start, end);
    }, [filteredEntries, currentPlayersPage]);

    return {
        calculations,
        filteredEntries,
        liveEntries,
        rosterSummaries,
        totalFilteredPlayers,
        totalPlayersPages,
        paginatedEntries,
    };
}
