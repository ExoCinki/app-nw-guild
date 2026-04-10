export type PublicScoreboardEntry = {
    id: string;
    playerName: string;
    kills: number;
    deaths: number;
    assists: number;
    damageDealt: number;
    healingDone: number;
};

export type PublicScoreboardSession = {
    id: string;
    discordGuildId: string;
    guildName: string | null;
    name: string | null;
    status: string;
    createdAt: string;
    entries: PublicScoreboardEntry[];
};

export type PublicScoreboardResponse = {
    sessions: PublicScoreboardSession[];
};

/** Stats agrégées toutes sessions confondues pour un joueur. */
export type PlayerAggregate = {
    key: string;
    playerName: string;
    sessionsPlayed: number;
    kills: number;
    deaths: number;
    assists: number;
    damageDealt: number;
    healingDone: number;
    updatedAt: string;
};

/** Ligne dans l'historique de session d'un joueur focalisé. */
export type FocusedPlayerSession = {
    sessionId: string;
    sessionName: string;
    guildName: string;
    status: string;
    createdAt: string;
    kills: number;
    deaths: number;
    assists: number;
    damageDealt: number;
    healingDone: number;
};

export type ViewMode = "sessions" | "players";

export type SessionSortKey =
    | "playerName"
    | "kills"
    | "deaths"
    | "assists"
    | "damageDealt"
    | "healingDone";

export type PlayerSortKey =
    | "playerName"
    | "sessionsPlayed"
    | "kills"
    | "deaths"
    | "assists"
    | "kda"
    | "kd"
    | "damageDealt"
    | "healingDone"
    | "updatedAt";

export type SortDir = "asc" | "desc";
