export type AdminGuild = {
    discordGuildId: string;
    name: string | null;
    createdAt: string;
};

export type AdminUser = {
    id: string;
    discordId: string | null;
    displayName: string | null;
    name: string | null;
    email: string | null;
    selectedGuild: {
        discordGuildId: string;
        discordGuildName: string | null;
        selectedAt: string;
    } | null;
    createdAt: string;
};

export type AdminAccess = {
    userId: string;
    discordGuildId: string;
    canReadRoster: boolean;
    canWriteRoster: boolean;
    canReadPayout: boolean;
    canWritePayout: boolean;
    canReadConfiguration: boolean;
    canWriteConfiguration: boolean;
    updatedAt: string;
};

export type AdminBan = {
    discordId: string;
    reason: string | null;
    createdAt: string;
    bannedByUserId: string | null;
};

export type AdminConfiguration = {
    discordGuildId: string;
    apiKey: string | null;
    channelId: string | null;
    zooMemberRoleId: string | null;
    zooMemberRoleName: string | null;
    warsCount: number;
    racesCount: number;
    invasionsCount: number;
    vodsCount: number;
    reviewsCount: number;
    bonusCount: number;
    updatedAt: string;
};

export type AdminGlobalResponse = {
    guilds: AdminGuild[];
    users: AdminUser[];
    accesses: AdminAccess[];
    bans: AdminBan[];
    configurations: AdminConfiguration[];
};
