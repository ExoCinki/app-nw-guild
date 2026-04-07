import { prisma } from "@/lib/prisma";

const DISCORD_ADMINISTRATOR = BigInt(0x8);
const DISCORD_MANAGE_GUILD = BigInt(0x20);

type ManagedGuild = {
    id: string;
    name: string | null;
    iconUrl: string | null;
};

export type ManagedWhitelistedGuildsResult =
    | { ok: true; guilds: ManagedGuild[] }
    | { ok: false; status: 401 | 403 | 503; error: string };

type ManagedGuildsCacheEntry = {
    guilds: ManagedGuild[];
    expiresAt: number;
};

type ManagedGuildsCacheStore = Map<string, ManagedGuildsCacheEntry>;

const MANAGED_GUILDS_CACHE_TTL_MS = 60_000;

declare global {
    var __managedGuildsCache: ManagedGuildsCacheStore | undefined;
}

function getManagedGuildsCache(): ManagedGuildsCacheStore {
    if (!globalThis.__managedGuildsCache) {
        globalThis.__managedGuildsCache = new Map<string, ManagedGuildsCacheEntry>();
    }

    return globalThis.__managedGuildsCache;
}

function getCachedManagedGuilds(userEmail: string): ManagedGuild[] | null {
    const cache = getManagedGuildsCache();
    const entry = cache.get(userEmail);

    if (!entry) {
        return null;
    }

    if (entry.expiresAt <= Date.now()) {
        cache.delete(userEmail);
        return null;
    }

    return entry.guilds;
}

function setCachedManagedGuilds(userEmail: string, guilds: ManagedGuild[]) {
    const cache = getManagedGuildsCache();
    cache.set(userEmail, {
        guilds,
        expiresAt: Date.now() + MANAGED_GUILDS_CACHE_TTL_MS,
    });
}

type DiscordGuild = {
    id: string;
    name: string;
    icon: string | null;
    permissions: string | number;
};

type DiscordGuildsFetchResult = {
    guilds: DiscordGuild[] | null;
    status: number;
};

async function fetchDiscordGuilds(accessToken: string): Promise<DiscordGuildsFetchResult> {
    try {
        const discordRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            cache: "no-store",
        });

        if (!discordRes.ok) {
            return { guilds: null, status: discordRes.status };
        }

        return {
            guilds: (await discordRes.json()) as DiscordGuild[],
            status: discordRes.status,
        };
    } catch {
        return { guilds: null, status: 0 };
    }
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
): Promise<ManagedWhitelistedGuildsResult> {
    const user = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { id: true, discordId: true },
    });

    const ownerDiscordId = process.env.OWNER_DISCORD_ID;
    const isOwner = Boolean(
        ownerDiscordId && user?.discordId && user.discordId === ownerDiscordId,
    );

    if (user?.discordId && !isOwner) {
        const ban = await prisma.bannedDiscordUser.findUnique({
            where: { discordId: user.discordId },
            select: { id: true },
        });

        if (ban) {
            return { ok: false, status: 403, error: "This Discord account has been banned by an administrator" };
        }
    }

    const cachedGuilds = getCachedManagedGuilds(userEmail);
    if (cachedGuilds) {
        return { ok: true, guilds: cachedGuilds };
    }

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
        return { ok: false, status: 401, error: "No Discord token found" };
    }

    let guilds: DiscordGuild[] | null = null;
    let discordStatus: number | null = null;

    if (account.access_token) {
        const fetched = await fetchDiscordGuilds(account.access_token);
        guilds = fetched.guilds;
        discordStatus = fetched.status;
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

            const fetched = await fetchDiscordGuilds(refreshed.accessToken);
            guilds = fetched.guilds;
            discordStatus = fetched.status;
        }
    }

    if (!guilds) {
        if (
            discordStatus === 429 ||
            discordStatus === 0 ||
            (discordStatus !== null && discordStatus >= 500)
        ) {
            return {
                ok: false,
                status: 503,
                error: "Discord API unavailable or rate limited, retry in a few seconds",
            };
        }

        return { ok: false, status: 401, error: "No Discord token found" };
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

    const accessOverrides = user?.id
        ? await prisma.guildUserAccess.findMany({
            where: { userId: user.id },
            select: {
                discordGuildId: true,
                canReadRoster: true,
                canReadPayout: true,
                canReadConfiguration: true,
            },
        })
        : [];

    const overrideByGuildId = new Map(
        accessOverrides.map((item) => [item.discordGuildId, item]),
    );

    const delegatedReadableGuildIds = new Set(
        accessOverrides
            .filter(
                (item) =>
                    item.canReadRoster ||
                    item.canReadPayout ||
                    item.canReadConfiguration,
            )
            .map((item) => item.discordGuildId),
    );

    const managedGuilds = whitelistedGuilds
        .filter((guild: { discordGuildId: string; name: string | null }) => {
            const guildId = guild.discordGuildId;
            const hasAdminAccess = adminGuildIds.has(guildId);
            const hasDelegatedReadAccess = delegatedReadableGuildIds.has(guildId);

            const override = overrideByGuildId.get(guildId);

            if (override) {
                return (
                    override.canReadRoster ||
                    override.canReadPayout ||
                    override.canReadConfiguration
                );
            }

            return hasAdminAccess || hasDelegatedReadAccess;
        })
        .map((guild: { discordGuildId: string; name: string | null }) => ({
            id: guild.discordGuildId,
            name: guild.name ?? guildMap.get(guild.discordGuildId)?.name ?? null,
            iconUrl: guildMap.get(guild.discordGuildId)?.icon
                ? `https://cdn.discordapp.com/icons/${guild.discordGuildId}/${guildMap.get(guild.discordGuildId)?.icon}.png?size=64`
                : null,
        }));

    setCachedManagedGuilds(userEmail, managedGuilds);

    return { ok: true, guilds: managedGuilds };
}
