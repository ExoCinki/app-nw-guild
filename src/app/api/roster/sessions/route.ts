import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishLiveUpdate } from "@/lib/live-updates";
import { apiHandler, requireAuth, requireGuildAuth } from "@/lib/route-guard";
import { setSelectedRosterSession } from "@/lib/roster-session";

export const dynamic = "force-dynamic";

export const GET = apiHandler("GET /api/roster/sessions", async (request: NextRequest) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const guild = await requireGuildAuth(auth.email, request.nextUrl.searchParams.get("guildId"), "roster");
    if ("response" in guild) return guild.response;

    const sessions = await prisma.roster.findMany({
        where: { discordGuildId: guild.resolved.guildId },
        include: {
            shares: { select: { shareUrl: true, updatedAt: true } },
            groups: {
                select: {
                    slots: {
                        select: { playerName: true },
                    },
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    const payload = sessions.map((session) => ({
        id: session.id,
        discordGuildId: session.discordGuildId,
        name: session.name,
        status: session.status,
        isLocked: session.isLocked,
        lockedByUserId: session.lockedByUserId,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        selectedEventId: session.selectedEventId,
        shares: session.shares,
        playersCount: session.groups
            .flatMap((group) => group.slots)
            .filter((slot) => Boolean(slot.playerName?.trim())).length,
    }));

    return NextResponse.json(payload);
});

export const POST = apiHandler("POST /api/roster/sessions", async (request: NextRequest) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const payload = (await request.json().catch(() => ({}))) as {
        guildId?: string;
        name?: string;
    };

    const guild = await requireGuildAuth(auth.email, payload.guildId ?? null, "roster", "write");
    if ("response" in guild) return guild.response;

    const existingCount = await prisma.roster.count({
        where: { discordGuildId: guild.resolved.guildId },
    });

    const sessionName = payload.name?.trim() || `Session ${existingCount + 1}`;

    const rosterSession = await prisma.roster.create({
        data: {
            discordGuildId: guild.resolved.guildId,
            name: sessionName,
            createdByUserId: guild.resolved.userId,
        },
    });

    await setSelectedRosterSession({
        userId: guild.resolved.userId,
        guildId: guild.resolved.guildId,
        rosterId: rosterSession.id,
    });

    publishLiveUpdate({ topic: "roster", guildId: guild.resolved.guildId });

    return NextResponse.json(rosterSession, { status: 201 });
});
