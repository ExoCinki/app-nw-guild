import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

export type RosterSlotData = {
    position: number;
    playerName: string | null;
    role: string | null;
};

export type RosterGroupData = {
    groupNumber: number;
    name: string | null;
    slots: RosterSlotData[];
};

export type RaidHelperImportFilterPreset = "classic" | "euna";

export type RosterResponse = {
    guild: { id: string; name: string | null };
    rosterSession: {
        id: string;
        name: string | null;
        status: string;
        isLocked: boolean;
        lockedByUserId: string | null;
    };
    roster: {
        selectedEventId: string | null;
        selectedImportFilterPreset: RaidHelperImportFilterPreset;
        playerSearchQuery: string;
        enableSecondRoster: boolean;
        groups: RosterGroupData[];
        secondGroups: RosterGroupData[];
    };
};

export type RosterSessionSummary = {
    id: string;
    name: string | null;
    status: string;
    isLocked: boolean;
    lockedByUserId: string | null;
    shares?: Array<{ shareUrl: string; updatedAt: string }>;
    playersCount?: number;
};

export type PostGroupPayload = {
    guildId?: string;
    sessionId?: string;
    rosterIndex?: 1 | 2;
    groupNumber: number;
    name: string | null;
    slots: Array<{
        position: number;
        playerName: string | null;
        role: string | null;
    }>;
};

export type RaidHelperEvent = {
    id: string;
    channelId: string;
    title: string;
    startTime: number;
    endTime: number | null;
    signUps: number;
    leaderId: string;
    leaderName: string | null;
    description: string | null;
};

export type RaidHelperEventsResponse = {
    events: RaidHelperEvent[];
    channelId: string;
    eventsCachedAt?: string | null;
};

export type RaidHelperParticipant = {
    name: string | null;
    userId: string | null;
    specName: string | null;
    className: string | null;
};

export type RaidHelperParticipantsResponse = {
    participants: RaidHelperParticipant[];
    participantsCachedAt?: string | null;
};

export type DragParticipantPayload = {
    name: string | null;
    userId: string | null;
    specName: string | null;
    className: string | null;
};

export type RoleKey =
    | "tank"
    | "bruiser"
    | "dps"
    | "heal"
    | "debuff"
    | "dex"
    | "late"
    | "tentative"
    | "bench"
    | null;

export type ParticipantCountBadge = {
    key: string;
    count: number;
    icon: IconDefinition;
    color: string;
    label: string;
};
