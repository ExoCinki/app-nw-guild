import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type GuildAccessScope = "roster" | "payout" | "configuration" | "archives";
export type GuildAccessMode = "read" | "write";

export type GuildScopeReadAccessSummary = {
    roster: boolean;
    payout: boolean;
    configuration: boolean;
    archives: boolean;
};

const EMPTY_GUILD_SCOPE_READ_ACCESS: GuildScopeReadAccessSummary = {
    roster: false,
    payout: false,
    configuration: false,
    archives: false,
};

async function getCurrentAdminIdentity() {
    const session = await getServerSession(authOptions);
    const ownerDiscordId = process.env.OWNER_DISCORD_ID;

    if (!session?.user?.id && !session?.user?.email) {
        return { status: "unauthorized" as const, session, ownerDiscordId };
    }

    const dbUser = await prisma.user.findFirst({
        where: {
            OR: [
                ...(session.user.id ? [{ id: session.user.id }] : []),
                ...(session.user.email ? [{ email: session.user.email }] : []),
            ],
        },
        select: {
            id: true,
            discordId: true,
        },
    });

    if (!dbUser) {
        return { status: "unauthorized" as const, session, ownerDiscordId };
    }

    let effectiveDiscordId = dbUser.discordId;

    if (!effectiveDiscordId) {
        const discordAccount = await prisma.account.findFirst({
            where: {
                userId: dbUser.id,
                provider: "discord",
            },
            select: {
                providerAccountId: true,
            },
        });

        if (discordAccount?.providerAccountId) {
            effectiveDiscordId = discordAccount.providerAccountId;

            await prisma.user.update({
                where: { id: dbUser.id },
                data: {
                    discordId: effectiveDiscordId,
                },
            });
        }
    }

    const globalAdmin = await isGlobalAdmin(dbUser.id);
    const isOwner = Boolean(
        ownerDiscordId && effectiveDiscordId && effectiveDiscordId === ownerDiscordId,
    );

    return {
        status: "ok" as const,
        session,
        ownerDiscordId,
        userId: dbUser.id,
        effectiveDiscordId,
        isOwner,
        isGlobalAdmin: globalAdmin,
    };
}

export async function getOwnerGuardStatus() {
    const identity = await getCurrentAdminIdentity();

    if (identity.status !== "ok") {
        return identity;
    }

    if (!identity.ownerDiscordId) {
        return { ...identity, status: "misconfigured" as const };
    }

    if (!identity.isOwner) {
        return { ...identity, status: "forbidden" as const };
    }

    return identity;
}

export async function getAdminGuardStatus() {
    const identity = await getCurrentAdminIdentity();

    if (identity.status !== "ok") {
        return identity;
    }

    if (!identity.isOwner && !identity.isGlobalAdmin) {
        return { ...identity, status: "forbidden" as const };
    }

    return identity;
}

export async function isGlobalAdmin(userId: string): Promise<boolean> {
    const record = await prisma.globalAdmin.findUnique({
        where: { userId },
        select: { id: true },
    });
    return Boolean(record);
}

export async function isDiscordIdBanned(discordId: string) {
    const ban = await prisma.bannedDiscordUser.findUnique({
        where: { discordId },
        select: { id: true },
    });

    return Boolean(ban);
}

export async function hasGuildScopeAccess(params: {
    userId: string;
    discordGuildId: string;
    scope: GuildAccessScope;
    mode: GuildAccessMode;
    isOwner: boolean;
}) {
    if (params.isOwner) {
        return true;
    }

    const globalAdmin = await isGlobalAdmin(params.userId);
    if (globalAdmin) {
        return true;
    }

    const access = await prisma.guildUserAccess.findUnique({
        where: {
            userId_discordGuildId: {
                userId: params.userId,
                discordGuildId: params.discordGuildId,
            },
        },
        select: {
            canReadRoster: true,
            canWriteRoster: true,
            canReadPayout: true,
            canWritePayout: true,
            canReadConfiguration: true,
            canWriteConfiguration: true,
            canReadArchives: true,
            canWriteArchives: true,
        },
    });

    if (!access) {
        return false;
    }

    if (params.scope === "roster") {
        return params.mode === "read" ? access.canReadRoster : access.canWriteRoster;
    }

    if (params.scope === "payout") {
        return params.mode === "read" ? access.canReadPayout : access.canWritePayout;
    }

    if (params.scope === "archives") {
        return params.mode === "read" ? access.canReadArchives : access.canWriteArchives;
    }

    return params.mode === "read"
        ? access.canReadConfiguration
        : access.canWriteConfiguration;
}

export async function getGuildScopeReadAccessSummary(params: {
    userId: string;
    discordGuildId: string;
    isOwner: boolean;
    isGlobalAdmin?: boolean;
}): Promise<GuildScopeReadAccessSummary> {
    if (params.isOwner) {
        return {
            roster: true,
            payout: true,
            configuration: true,
            archives: true,
        };
    }

    const globalAdmin = params.isGlobalAdmin ?? (await isGlobalAdmin(params.userId));

    if (globalAdmin) {
        return {
            roster: true,
            payout: true,
            configuration: true,
            archives: true,
        };
    }

    const access = await prisma.guildUserAccess.findUnique({
        where: {
            userId_discordGuildId: {
                userId: params.userId,
                discordGuildId: params.discordGuildId,
            },
        },
        select: {
            canReadRoster: true,
            canReadPayout: true,
            canReadConfiguration: true,
            canReadArchives: true,
        },
    });

    if (!access) {
        return EMPTY_GUILD_SCOPE_READ_ACCESS;
    }

    return {
        roster: access.canReadRoster,
        payout: access.canReadPayout,
        configuration: access.canReadConfiguration,
        archives: access.canReadArchives,
    };
}
