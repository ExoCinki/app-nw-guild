import { prisma } from "@/lib/prisma";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";

export async function resolveManagedGuildForUser(
    email: string,
    guildIdFromRequest?: string | null,
): Promise<
    | { userId: string; guildId: string }
    | { error: string; status: 400 | 401 | 403 | 404 }
> {
    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
    });

    if (!user) {
        return { error: "User not found", status: 404 };
    }

    const manageableGuilds = await getManagedWhitelistedGuilds(email);

    if (!manageableGuilds) {
        return { error: "No Discord token found", status: 401 };
    }

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

    return { userId: user.id, guildId };
}
