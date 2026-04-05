import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DISCORD_ADMINISTRATOR = BigInt(0x8);
const DISCORD_MANAGE_GUILD = BigInt(0x20);

type DiscordGuild = {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string;
};

type AdminGuild = {
    id: string;
    name: string;
    icon: string | null;
};

function hasAdminRights(guild: DiscordGuild): boolean {
    if (guild.owner) {
        return true;
    }

    try {
        const permissions = BigInt(guild.permissions);
        return (
            (permissions & DISCORD_ADMINISTRATOR) === DISCORD_ADMINISTRATOR ||
            (permissions & DISCORD_MANAGE_GUILD) === DISCORD_MANAGE_GUILD
        );
    } catch {
        return false;
    }
}

export const dynamic = "force-dynamic";

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const discordAccount = await prisma.account.findFirst({
        where: {
            userId: session.user.id,
            provider: "discord",
        },
        select: {
            access_token: true,
        },
    });

    if (!discordAccount?.access_token) {
        return NextResponse.json(
            { error: "Discord account token unavailable" },
            { status: 400 },
        );
    }

    const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${discordAccount.access_token}`,
        },
        cache: "no-store",
    });

    if (!response.ok) {
        return NextResponse.json(
            { error: "Failed to fetch Discord guilds" },
            { status: response.status },
        );
    }

    const guilds = (await response.json()) as DiscordGuild[];
    const whitelistedGuilds = await prisma.whitelistedGuild.findMany({
        select: {
            discordGuildId: true,
        },
    });

    const whitelistSet = new Set(whitelistedGuilds.map((guild) => guild.discordGuildId));

    if (whitelistSet.size === 0) {
        return NextResponse.json({ guilds: [] });
    }

    const adminGuilds: AdminGuild[] = guilds
        .filter((guild) => hasAdminRights(guild) && whitelistSet.has(guild.id))
        .map((guild) => ({
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
        }));

    return NextResponse.json({ guilds: adminGuilds });
}