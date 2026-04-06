import { prisma } from "@/lib/prisma";

const DISCORD_ADMINISTRATOR = BigInt(0x8);
const DISCORD_MANAGE_GUILD = BigInt(0x20);

type ManagedGuild = {
    id: string;
    name: string | null;
    iconUrl: string | null;
};

type DiscordGuild = {
    id: string;
    name: string;
    icon: string | null;
    permissions: string | number;
};

async function fetchDiscordGuilds(accessToken: string): Promise<DiscordGuild[] | null> {
    const discordRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
    });

    if (!discordRes.ok) {
        return null;
    }

    return (await discordRes.json()) as DiscordGuild[];
}

async function refreshDiscordAccessToken(
    refreshToken: string,
): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: number | null;
} | null> {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return null;
    }

    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
    });

    const response = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        cache: "no-store",
    });

    if (!response.ok) {
        return null;
    }

    const payload = (await response.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
    };

    if (!payload.access_token) {
        return null;
    }

    return {
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token ?? refreshToken,
        expiresAt:
            typeof payload.expires_in === "number"
                ? Math.floor(Date.now() / 1000) + payload.expires_in
                : null,
    };
}

export async function getManagedWhitelistedGuilds(
    userEmail: string,
): Promise<ManagedGuild[] | null> {
    const account = await prisma.account.findFirst({
        where: {
            user: { email: userEmail },
            provider: "discord",
        },
        select: {
            id: true,
            access_token: true,
            refresh_token: true,
        },
    });

    if (!account) {
        return null;
    }

    let guilds: DiscordGuild[] | null = null;

    if (account.access_token) {
        guilds = await fetchDiscordGuilds(account.access_token);
    }

    // Si le token est absent/expire, tente un refresh OAuth puis reessaie.
    if (!guilds && account.refresh_token) {
        const refreshed = await refreshDiscordAccessToken(account.refresh_token);

        if (refreshed) {
            await prisma.account.update({
                where: { id: account.id },
                data: {
                    access_token: refreshed.accessToken,
                    refresh_token: refreshed.refreshToken,
                    expires_at: refreshed.expiresAt,
                },
            });

            guilds = await fetchDiscordGuilds(refreshed.accessToken);
        }
    }

    if (!guilds) {
        return null;
    }

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
