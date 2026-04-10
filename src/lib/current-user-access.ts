import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
    getGuildScopeReadAccessSummary,
    isGlobalAdmin,
    type GuildScopeReadAccessSummary,
} from "@/lib/admin-access";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";
import { prisma } from "@/lib/prisma";

const EMPTY_ACCESS: GuildScopeReadAccessSummary = {
    roster: false,
    payout: false,
    scoreboard: false,
    configuration: false,
    archives: false,
};

export async function getCurrentUserAccessState() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return { status: "unauthorized" as const };
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
            id: true,
            displayName: true,
            discordId: true,
            name: true,
            email: true,
            image: true,
        },
    });

    if (!user) {
        return { status: "not-found" as const };
    }

    const selectedGuild = await prisma.selectedGuild.findUnique({
        where: { userId: user.id },
        select: { discordGuildId: true },
    });

    const globalAdmin = await isGlobalAdmin(user.id);
    const ownerDiscordId = process.env.OWNER_DISCORD_ID;
    const owner = Boolean(
        ownerDiscordId && user.discordId && user.discordId === ownerDiscordId,
    );

    let hasSelectedGuildAccess = false;
    let access = EMPTY_ACCESS;

    if (selectedGuild?.discordGuildId) {
        const manageableGuildsResult = await getManagedWhitelistedGuilds(session.user.email);

        if (manageableGuildsResult.ok) {
            hasSelectedGuildAccess = manageableGuildsResult.guilds.some(
                (guild) => guild.id === selectedGuild.discordGuildId,
            );

            if (hasSelectedGuildAccess) {
                access = await getGuildScopeReadAccessSummary({
                    userId: user.id,
                    discordGuildId: selectedGuild.discordGuildId,
                    isOwner: owner,
                    isGlobalAdmin: globalAdmin,
                });
            }
        }
    }

    return {
        status: "ok" as const,
        user: {
            id: user.id,
            displayName: user.displayName ?? user.name,
            discordId: user.discordId,
            email: user.email,
            image: user.image,
        },
        selectedGuildId: selectedGuild?.discordGuildId ?? null,
        hasSelectedGuildAccess,
        access,
        isGlobalAdmin: globalAdmin,
        isOwner: owner,
    };
}