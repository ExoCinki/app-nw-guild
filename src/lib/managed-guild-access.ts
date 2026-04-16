import { prisma } from "@/lib/prisma";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";
import {
    hasGuildScopeAccess,
    type GuildAccessMode,
    type GuildAccessScope,
} from "@/lib/admin-access";

export async function resolveManagedGuildForUser(
    email: string,
    guildIdFromRequest?: string | null,
    scope?: GuildAccessScope,
    mode: GuildAccessMode = "read",
): Promise<
    | { userId: string; guildId: string }
    | { error: string; status: 400 | 401 | 403 | 404 | 503 }
> {
    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, discordId: true },
    });

    if (!user) {
        return { error: "User not found", status: 404 };
    }

    const manageableGuildsResult = await getManagedWhitelistedGuilds(email);

    if (!manageableGuildsResult.ok) {
        return { error: manageableGuildsResult.error, status: manageableGuildsResult.status };
    }

    const manageableGuilds = manageableGuildsResult.guilds;

    let guildId = guildIdFromRequest ?? null;

    if (!guildId) {
        const selectedGuild = await prisma.selectedGuild.findUnique({
            where: { userId: user.id },
            select: { discordGuildId: true },
        });

        guildId = selectedGuild?.discordGuildId ?? null;
    }

    if (!guildId) {
        return { error: "No guild selected", status: 400 };
    }

    const hasAccess = manageableGuilds.some((guild) => guild.id === guildId);

    if (!hasAccess) {
        return { error: "Guild is not manageable for this account", status: 403 };
    }

    if (scope) {
        const ownerDiscordId = process.env.OWNER_DISCORD_ID;
        const isOwner = Boolean(
            ownerDiscordId &&
            user.discordId &&
            user.discordId === ownerDiscordId,
        );

        const hasScopedAccess = await hasGuildScopeAccess({
            userId: user.id,
            discordGuildId: guildId,
            scope,
            mode,
            isOwner,
        });

        if (!hasScopedAccess) {
            return { error: "Access denied for this module on the selected server", status: 403 };
        }
    }

    return { userId: user.id, guildId };
}
