type DiscordRole = {
    id: string;
    name: string;
    position: number;
};

const preferredBotTokenByGuild = new Map<string, string>();
const DISCORD_FETCH_TIMEOUT_MS = 7_000;

function getDiscordBotTokens(): string[] {
    const multi = (process.env.DISCORD_BOT_TOKENS ?? "")
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);
    const single = (process.env.DISCORD_BOT_TOKEN ?? "").trim();

    return [...new Set([...multi, ...(single ? [single] : [])])];
}

export async function getDiscordGuildRoles(guildId: string): Promise<{
    roles: DiscordRole[];
    rolesError: string | null;
}> {
    const tokens = getDiscordBotTokens();

    if (tokens.length === 0) {
        return {
            roles: [],
            rolesError: "DISCORD_BOT_TOKEN or DISCORD_BOT_TOKENS missing to load roles.",
        };
    }

    const preferred = preferredBotTokenByGuild.get(guildId);
    const orderedTokens = preferred
        ? [preferred, ...tokens.filter((token) => token !== preferred)]
        : tokens;

    let lastStatus: number | null = null;
    let retryAfterSeconds: number | null = null;

    for (const botToken of orderedTokens) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), DISCORD_FETCH_TIMEOUT_MS);
        let response: Response;

        try {
            response = await fetch(
                `https://discord.com/api/v10/guilds/${guildId}/roles`,
                {
                    headers: {
                        Authorization: `Bot ${botToken}`,
                    },
                    cache: "no-store",
                    signal: controller.signal,
                },
            );
            clearTimeout(timeout);
        } catch {
            clearTimeout(timeout);
            lastStatus = 0;
            continue;
        }

        lastStatus = response.status;

        if (response.status === 429) {
            const retryAfter = Number.parseFloat(response.headers.get("retry-after") ?? "");
            if (Number.isFinite(retryAfter) && retryAfter > 0) {
                retryAfterSeconds = Math.ceil(retryAfter);
            }
        }

        if (!response.ok) {
            continue;
        }

        preferredBotTokenByGuild.set(guildId, botToken);

        const roles = (await response.json()) as Array<{
            id: string;
            name: string;
            position: number;
            managed?: boolean;
            tags?: {
                bot_id?: string;
                integration_id?: string;
            };
        }>;

        const filtered = roles
            .filter((role) => role.id !== guildId)
            .filter(
                (role) =>
                    !role.managed &&
                    !role.tags?.bot_id &&
                    !role.tags?.integration_id,
            )
            .sort((a, b) => b.position - a.position)
            .map((role) => ({
                id: role.id,
                name: role.name,
                position: role.position,
            }));

        return {
            roles: filtered,
            rolesError: null,
        };
    }

    return {
        roles: [],
        rolesError:
            lastStatus === 429 && retryAfterSeconds
                ? `Discord rate limited while loading roles, retry in about ${retryAfterSeconds} seconds.`
                : lastStatus !== null
                    ? `Unable to load Discord roles for this server (status ${lastStatus}).`
                    : "Unable to load Discord roles for this server.",
    };
}

export type { DiscordRole };
