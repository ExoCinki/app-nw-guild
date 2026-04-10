import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishLiveUpdate } from "@/lib/live-updates";
import { apiHandler, requireAuth, requireGuildAuth } from "@/lib/route-guard";

export const dynamic = "force-dynamic";

// ─── POST : ajouter un joueur ─────────────────────────────────────────────────

export const POST = apiHandler("POST /api/payout/entries", async (request: NextRequest) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const payload = (await request.json()) as {
        sessionId: string;
        discordUserId: string;
        username: string;
        displayName?: string;
        guildId?: string;
    };

    const guild = await requireGuildAuth(auth.email, payload.guildId, "payout", "write");
    if ("response" in guild) return guild.response;

    const targetSession = await prisma.payoutSession.findFirst({
        where: { id: payload.sessionId, discordGuildId: guild.resolved.guildId },
        select: { id: true },
    });

    if (!targetSession) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const entry = await prisma.payoutEntry.create({
        data: {
            sessionId: payload.sessionId,
            discordGuildId: guild.resolved.guildId,
            discordUserId: payload.discordUserId,
            username: payload.username,
            displayName: payload.displayName || payload.username,
        },
    });

    publishLiveUpdate({ topic: "payout", guildId: guild.resolved.guildId });

    return NextResponse.json(entry, { status: 201 });
});

// ─── PATCH : modifier une entrée ─────────────────────────────────────────────

export const PATCH = apiHandler("PATCH /api/payout/entries", async (request: NextRequest) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const payload = (await request.json()) as {
        entryId: string;
        updates?: {
            wars?: number;
            races?: number;
            reviews?: number;
            bonus?: number;
            invasions?: number;
            vods?: number;
            isPaid?: boolean;
            displayName?: string;
        };
        guildId?: string;
    };

    const guild = await requireGuildAuth(auth.email, payload.guildId, "payout", "write");
    if ("response" in guild) return guild.response;

    const targetEntry = await prisma.payoutEntry.findFirst({
        where: { id: payload.entryId, discordGuildId: guild.resolved.guildId },
        select: { id: true },
    });

    if (!targetEntry) {
        return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const entry = await prisma.payoutEntry.update({
        where: { id: payload.entryId },
        data: payload.updates || {},
    });

    publishLiveUpdate({ topic: "payout", guildId: guild.resolved.guildId });

    return NextResponse.json(entry);
});

// ─── DELETE : supprimer une entrée ───────────────────────────────────────────

export const DELETE = apiHandler("DELETE /api/payout/entries", async (request: NextRequest) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const payload = (await request.json()) as { entryId: string; guildId?: string };

    const guild = await requireGuildAuth(auth.email, payload.guildId, "payout", "write");
    if ("response" in guild) return guild.response;

    const targetEntry = await prisma.payoutEntry.findFirst({
        where: { id: payload.entryId, discordGuildId: guild.resolved.guildId },
        select: { id: true },
    });

    if (!targetEntry) {
        return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    await prisma.payoutEntry.delete({ where: { id: payload.entryId } });

    publishLiveUpdate({ topic: "payout", guildId: guild.resolved.guildId });

    return NextResponse.json({ success: true });
});
