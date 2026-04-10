import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishLiveUpdate } from "@/lib/live-updates";
import { apiHandler, requireAuth, requireGuildAuth } from "@/lib/route-guard";

export const dynamic = "force-dynamic";

export const POST = apiHandler("POST /api/payout/import-roster", async (request: NextRequest) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const payload = (await request.json()) as { sessionId: string; guildId?: string };

    const guild = await requireGuildAuth(auth.email, payload.guildId, "payout", "write");
    if ("response" in guild) return guild.response;

    const sessionExists = await prisma.payoutSession.findFirst({
        where: { id: payload.sessionId, discordGuildId: guild.resolved.guildId },
        select: { id: true },
    });

    if (!sessionExists) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const roster = await prisma.roster.findUnique({
        where: { discordGuildId: guild.resolved.guildId },
        include: { groups: { include: { slots: true } } },
    });

    if (!roster) {
        return NextResponse.json({ error: "No roster found" }, { status: 404 });
    }

    const playerMap = new Map<string, { name: string; displayName: string; id: string }>();

    for (const group of roster.groups) {
        for (const slot of group.slots) {
            if (slot.playerName && !playerMap.has(slot.playerName)) {
                playerMap.set(slot.playerName, {
                    name: slot.playerName,
                    displayName: slot.playerName,
                    id: "",
                });
            }
        }
    }

    const entries: Awaited<ReturnType<typeof prisma.payoutEntry.upsert>>[] = [];

    for (const [, player] of playerMap) {
        try {
            const entry = await prisma.payoutEntry.upsert({
                where: {
                    sessionId_discordUserId: {
                        sessionId: payload.sessionId,
                        discordUserId: player.name,
                    },
                },
                update: {},
                create: {
                    sessionId: payload.sessionId,
                    discordGuildId: guild.resolved.guildId,
                    discordUserId: player.name,
                    username: player.name,
                    displayName: player.displayName,
                },
            });
            entries.push(entry);
        } catch (err) {
            console.error(`Error creating entry for ${player.name}:`, err);
        }
    }

    if (entries.length > 0) {
        publishLiveUpdate({ topic: "payout", guildId: guild.resolved.guildId });
    }

    return NextResponse.json({ imported: entries.length, entries });
});

