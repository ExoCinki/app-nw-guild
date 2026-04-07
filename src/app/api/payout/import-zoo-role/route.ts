import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveManagedGuildForUser } from "@/lib/managed-guild-access";
import { NextRequest, NextResponse } from "next/server";
import { publishLiveUpdate } from "@/lib/live-updates";

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
        .map((token) => token.trim())
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

    // Guardrail: 50 pages * 1000 = 50k members max per import.
    for (let page = 0; page < 50; page += 1) {
        const response = await fetch(
            `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`,
            {
                headers: {
                    Authorization: `Bot ${botToken}`,
                },
                cache: "no-store",
            },
        );

        if (!response.ok) {
            return null;
        }

        const pageMembers = (await response.json()) as DiscordGuildMember[];

        if (!Array.isArray(pageMembers) || pageMembers.length === 0) {
            break;
        }

        allMembers.push(...pageMembers);

        if (pageMembers.length < 1000) {
            break;
        }

        const last = pageMembers[pageMembers.length - 1];
        after = last.user.id;
    }

    return allMembers;
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = (await request.json()) as {
            sessionId: string;
            guildId?: string;
        };

        const resolved = await resolveManagedGuildForUser(
            session.user.email,
            payload.guildId ?? null,
            "payout",
            "write",
        );

        if ("error" in resolved) {
            return NextResponse.json(
                { error: resolved.error },
                { status: resolved.status },
            );
        }

        const targetSession = await prisma.payoutSession.findFirst({
            where: {
                id: payload.sessionId,
                discordGuildId: resolved.guildId,
            },
            select: { id: true },
        });

        if (!targetSession) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        const config = await prisma.guildConfiguration.findUnique({
            where: { discordGuildId: resolved.guildId },
            select: { zooMemberRoleId: true },
        });

        if (!config?.zooMemberRoleId) {
            return NextResponse.json(
                {
                    error:
                        "Zoo member role is not configured for this server. Set it in Configuration first.",
                },
                { status: 400 },
            );
        }

        const tokens = getDiscordBotTokens();
        if (tokens.length === 0) {
            return NextResponse.json(
                { error: "No bot token configured" },
                { status: 500 },
            );
        }

        let members: DiscordGuildMember[] | null = null;

        for (const token of tokens) {
            members = await fetchAllGuildMembersWithToken(resolved.guildId, token);
            if (members) {
                break;
            }
        }

        if (!members) {
            return NextResponse.json(
                {
                    error:
                        "Unable to fetch Discord members. Check bot permissions and Server Members Intent.",
                },
                { status: 503 },
            );
        }

        const zooMembers = members.filter(
            (member) =>
                member.roles?.includes(config.zooMemberRoleId as string) &&
                !member.user.bot,
        );

        if (zooMembers.length === 0) {
            return NextResponse.json({ imported: 0, matched: 0 });
        }

        const uniqueByDiscordUserId = new Map(
            zooMembers.map((member) => [member.user.id, member]),
        );

        const rows = Array.from(uniqueByDiscordUserId.values()).map((member) => ({
            sessionId: payload.sessionId,
            discordGuildId: resolved.guildId,
            discordUserId: member.user.id,
            username: member.user.username,
            displayName:
                member.nick || member.user.global_name || member.user.username,
        }));

        const result = await prisma.payoutEntry.createMany({
            data: rows,
            skipDuplicates: true,
        });

        if (result.count > 0) {
            publishLiveUpdate({ topic: "payout", guildId: resolved.guildId });
        }

        return NextResponse.json({
            imported: result.count,
            matched: rows.length,
        });
    } catch (error) {
        console.error("POST /api/payout/import-zoo-role", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
