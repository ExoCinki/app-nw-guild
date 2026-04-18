export interface PayoutSessionShare {
    shareUrl: string | null;
    updatedAt: string;
}

export interface PayoutEntry {
    id: string;
    sessionId: string;
    discordGuildId: string;
    discordUserId: string;
    username: string;
    displayName: string | null;
    wars: number;
    races: number;
    reviews: number;
    bonus: number;
    invasions: number;
    vods: number;
    isPaid: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface PayoutSession {
    id: string;
    discordGuildId: string;
    goldPool: number;
    status: string;
    name: string | null;
    isLocked: boolean;
    lockedByUserId: string | null;
    entries: PayoutEntry[];
    shares: PayoutSessionShare[];
    createdAt: string;
    updatedAt: string;
}

export interface DiscordUser {
    id: string;
    username: string;
    displayName: string;
    avatar: string | null;
}

export interface RosterSourceSession {
    id: string;
    name: string | null;
    status: string;
    isLocked: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface RosterSourceSlot {
    id: string;
    position: number;
    playerName: string | null;
}

export interface RosterSourceGroup {
    id: string;
    rosterIndex: number;
    groupNumber: number;
    name: string | null;
    slots: RosterSourceSlot[];
}

export interface PayoutRosterSourcePayload {
    sessions: RosterSourceSession[];
    selectedRosterSessionId: string | null;
    roster: {
        id: string;
        name: string | null;
        groups: RosterSourceGroup[];
    } | null;
}

export interface PayoutGuildConfig {
    warsCount?: number;
    racesCount?: number;
    reviewsCount?: number;
    bonusCount?: number;
    invasionsCount?: number;
    vodsCount?: number;
}

export interface PayoutCalculationsEntry extends PayoutEntry {
    points: number;
}

export interface PayoutCalculations {
    entries: PayoutCalculationsEntry[];
    totalPoints: number;
    goldPerPoint: number;
    multipliers: {
        wars: number;
        races: number;
        reviews: number;
        bonus: number;
        invasions: number;
        vods: number;
    };
}

export interface PayoutLiveEntry extends PayoutEntry {
    points: number;
    gold: number;
}

export interface PayoutRosterGroupSummary {
    groupId: string;
    groupNumber: number;
    groupName: string | null;
    playersCount: number;
    matchedPlayersCount: number;
    totalPoints: number;
    totalGold: number;
}

export interface PayoutRosterIndexSummary {
    rosterIndex: number;
    groups: PayoutRosterGroupSummary[];
    global: {
        playersCount: number;
        matchedPlayersCount: number;
        totalPoints: number;
        totalGold: number;
    };
}

export const PLAYERS_PER_PAGE = 25;
