import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishLiveUpdate } from "@/lib/live-updates";
import { apiHandler, requireAuth, requireGuildAuth } from "@/lib/route-guard";
import { parseIdListFromString } from "@/lib/config-lists";

export const dynamic = "force-dynamic";

type DiscordGuildMember = {
    roles: string[];
    nick: string | null;
    user: {
        id: string;
        username: string;
        global_name?: string | null;
        bot?: boolean;
    };
};

function getDiscordBotTokens(): string[] {
    const multi = (process.env.DISCORD_BOT_TOKENS ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    const single = (process.env.DISCORD_BOT_TOKEN ?? "").trim();
    return [...new Set([...multi, ...(single ? [single] : [])])];
}

async function fetchAllGuildMembersWithToken(
    guildId: string,
    botToken: string,
): Promise<DiscordGuildMember[] | null> {
    const allMembers: DiscordGuildMember[] = [];
    let after = "0";

    // Guardrail: 50 pages × 1000 = 50 000 membres max par import.
    for (let page = 0; page < 50; page += 1) {
        const res = await fetch(
            `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`,
            { headers: { Authorization: `Bot ${botToken}` }, cache: "no-store" },
        );

        if (!res.ok) return null;

        const pageMembers = (await res.json()) as DiscordGuildMember[];

        if (!Array.isArray(pageMembers) || pageMembers.length === 0) break;

        allMembers.push(...pageMembers);

        if (pageMembers.length < 1000) break;

        after = pageMembers[pageMembers.length - 1].user.id;
    }

    return allMembers;
}

export const POST = apiHandler("POST /api/payout/import-zoo-role", async (request: NextRequest) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const payload = (await request.json()) as { sessionId: string; guildId?: string };

    const guild = await requireGuildAuth(auth.email, payload.guildId, "payout", "write");
    if ("response" in guild) return guild.response;

    const targetSession = await prisma.payoutSession.findFirst({
        where: { id: payload.sessionId, discordGuildId: guild.resolved.guildId },
        select: { id: true },
    });

    if (!targetSession) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const config = await prisma.guildConfiguration.findUnique({
        where: { discordGuildId: guild.resolved.guildId },
        select: { zooMemberRoleId: true },
    });

    const configuredRoleIds = parseIdListFromString(config?.zooMemberRoleId);

    if (configuredRoleIds.length === 0) {
        return NextResponse.json(
            { error: "Zoo member role is not configured for this server. Set it in Configuration first." },
            { status: 400 },
        );
    }

    const tokens = getDiscordBotTokens();
    if (tokens.length === 0) {
        return NextResponse.json({ error: "No bot token configured" }, { status: 500 });
    }

    let members: DiscordGuildMember[] | null = null;
    for (const token of tokens) {
        members = await fetchAllGuildMembersWithToken(guild.resolved.guildId, token);
        if (members) break;
    }

    if (!members) {
        return NextResponse.json(
            { error: "Unable to fetch Discord members. Check bot permissions and Server Members Intent." },
            { status: 503 },
        );
    }

    const roleSet = new Set(configuredRoleIds);
    const zooMembers = members.filter((member) => {
        if (member.user.bot) {
            return false;
        }

        return Array.isArray(member.roles) && member.roles.some((roleId) => roleSet.has(roleId));
    });

    if (zooMembers.length === 0) {
        return NextResponse.json({ imported: 0, matched: 0 });
    }

    const uniqueByDiscordUserId = new Map(zooMembers.map((m) => [m.user.id, m]));

    const rows = Array.from(uniqueByDiscordUserId.values()).map((member) => ({
        sessionId: payload.sessionId,
        discordGuildId: guild.resolved.guildId,
        discordUserId: member.user.id,
        username: member.user.username,
        displayName: member.nick || member.user.global_name || member.user.username,
    }));

    const result = await prisma.payoutEntry.createMany({ data: rows, skipDuplicates: true });

    if (result.count > 0) {
        publishLiveUpdate({ topic: "payout", guildId: guild.resolved.guildId });
    }

    return NextResponse.json({ imported: result.count, matched: rows.length });
});
