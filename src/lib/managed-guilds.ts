import { prisma } from "@/lib/prisma";

const DISCORD_ADMINISTRATOR = BigInt(0x8);
const DISCORD_MANAGE_GUILD = BigInt(0x20);

type ManagedGuild = {
    id: string;
    name: string | null;
    iconUrl: string | null;
};

export async function getManagedWhitelistedGuilds(
    userEmail: string,
): Promise<ManagedGuild[] | null> {
    const account = await prisma.account.findFirst({
        where: {
            user: { email: userEmail },
            provider: "discord",
        },
        select: { access_token: true },
    });

    if (!account?.access_token) {
        return null;
    }

    const discordRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
        headers: {
            Authorization: `Bearer ${account.access_token}`,
        },
        cache: "no-store",
    });

    if (!discordRes.ok) {
        throw new Error("Failed to fetch Discord guilds");
    }

    const guilds = (await discordRes.json()) as Array<{
        id: string;
        name: string;
        icon: string | null;
        permissions: string | number;
    }>;

    const guildMap = new Map(guilds.map((guild) => [guild.id, guild]));

    const adminGuildIds = new Set(
        guilds
            .filter((guild) => {
                const permissions = BigInt(String(guild.permissions));
                return (
                    (permissions & DISCORD_ADMINISTRATOR) === DISCORD_ADMINISTRATOR ||
                    (permissions & DISCORD_MANAGE_GUILD) === DISCORD_MANAGE_GUILD
                );
            })
            .map((guild) => guild.id),
    );

    const whitelistedGuilds = await prisma.whitelistedGuild.findMany({
        select: {
            discordGuildId: true,
            name: true,
        },
    });

    return whitelistedGuilds
        .filter((guild) => adminGuildIds.has(guild.discordGuildId))
        .map((guild) => ({
            id: guild.discordGuildId,
            name: guild.name ?? guildMap.get(guild.discordGuildId)?.name ?? null,
            iconUrl: guildMap.get(guild.discordGuildId)?.icon
                ? `https://cdn.discordapp.com/icons/${guild.discordGuildId}/${guildMap.get(guild.discordGuildId)?.icon}.png?size=64`
                : null,
        }));
}
