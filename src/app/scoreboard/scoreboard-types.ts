export type ScoreboardEntry = {
    id: string;
    sessionId: string;
    playerName: string;
    kills: number;
    deaths: number;
    assists: number;
    damageDealt: number;
    healingDone: number;
    createdAt: string;
    updatedAt: string;
};

export type RosterSourceSession = {
    id: string;
    name: string | null;
    status: string;
    isLocked: boolean;
    createdAt: string;
    updatedAt: string;
};

export type RosterSourceGroupSlot = {
    id: string;
    position: number;
    playerName: string | null;
};

export type RosterSourceGroup = {
    id: string;
    rosterIndex: number;
    groupNumber: number;
    name: string | null;
    slots: RosterSourceGroupSlot[];
};

export type RosterSourcePayload = {
    sessions: RosterSourceSession[];
    selectedRosterSessionId: string | null;
    roster: {
        id: string;
        name: string | null;
        groups: RosterSourceGroup[];
    } | null;
};

export type ScoreboardSessionShare = {
    shareUrl: string | null;
    updatedAt: string;
};

export type ScoreboardSession = {
    id: string;
    discordGuildId: string;
    name: string | null;
    status: string;
    entries: ScoreboardEntry[];
    shares: ScoreboardSessionShare[];
    createdAt: string;
    updatedAt: string;
};

export type PlayerHistory = {
    playerName: string;
    sessionsPlayed: number;
    kills: number;
    deaths: number;
    assists: number;
    damageDealt: number;
    healingDone: number;
    updatedAt: string;
};

export type ViewMode = "sessions" | "history";

export type ScoreField =
    | "kills"
    | "deaths"
    | "assists"
    | "damageDealt"
    | "healingDone";

export type ScoreTotals = {
    kills: number;
    deaths: number;
    assists: number;
    damageDealt: number;
    healingDone: number;
};

export type GroupTotals = {
    groupId: string;
    groupNumber: number;
    groupName: string | null;
    totals: ScoreTotals;
    playersCount: number;
};

export type RosterIndexSummary = {
    rosterIndex: number;
    groups: GroupTotals[];
    global: ScoreTotals;
    uniquePlayersCount: number;
};

export type PlayerWarStats = {
    sessionId: string;
    sessionName: string;
    sessionStatus: string;
    sessionCreatedAt: string;
    kills: number;
    deaths: number;
    assists: number;
    damageDealt: number;
    healingDone: number;
};

export const SHARE_LINK_TTL_DAYS = 30;
