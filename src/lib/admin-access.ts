import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type GuildAccessScope = "roster" | "payout" | "configuration";
export type GuildAccessMode = "read" | "write";

export async function getOwnerGuardStatus() {
    const session = await getServerSession(authOptions);
    const ownerDiscordId = process.env.OWNER_DISCORD_ID;

    if (!session?.user?.id || !session.user.discordId) {
        return { status: "unauthorized" as const, session, ownerDiscordId };
    }

    if (!ownerDiscordId) {
        return { status: "misconfigured" as const, session, ownerDiscordId };
    }

    if (session.user.discordId !== ownerDiscordId) {
        return { status: "forbidden" as const, session, ownerDiscordId };
    }

    return { status: "ok" as const, session, ownerDiscordId };
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
        },
    });

    if (!access) {
        return true;
    }

    if (params.scope === "roster") {
        return params.mode === "read" ? access.canReadRoster : access.canWriteRoster;
    }

    if (params.scope === "payout") {
        return params.mode === "read" ? access.canReadPayout : access.canWritePayout;
    }

    return params.mode === "read"
        ? access.canReadConfiguration
        : access.canWriteConfiguration;
}
