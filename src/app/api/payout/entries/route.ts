import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishLiveUpdate } from "@/lib/live-updates";
import { apiHandler, requireAuth, requireGuildAuth } from "@/lib/route-guard";

export const dynamic = "force-dynamic";

function parseNonNegativeInt(value: unknown, field: string): number {
    if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
        throw new Error(`${field} must be a non-negative integer`);
    }

    return value;
}

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

    const sessionId = payload.sessionId?.trim();
    const discordUserId = payload.discordUserId?.trim();
    const username = payload.username?.trim();
    const displayName = payload.displayName?.trim();

    if (!sessionId) {
        return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    if (!discordUserId) {
        return NextResponse.json({ error: "discordUserId is required" }, { status: 400 });
    }

    if (!username) {
        return NextResponse.json({ error: "username is required" }, { status: 400 });
    }

    const guild = await requireGuildAuth(auth.email, payload.guildId, "payout", "write");
    if ("response" in guild) return guild.response;

    const targetSession = await prisma.payoutSession.findFirst({
        where: { id: sessionId, discordGuildId: guild.resolved.guildId },
        select: { id: true },
    });

    if (!targetSession) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const entry = await prisma.payoutEntry.create({
        data: {
            sessionId,
            discordGuildId: guild.resolved.guildId,
            discordUserId,
            username,
            displayName: displayName || username,
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

    const entryId = payload.entryId?.trim();
    if (!entryId) {
        return NextResponse.json({ error: "entryId is required" }, { status: 400 });
    }

    const guild = await requireGuildAuth(auth.email, payload.guildId, "payout", "write");
    if ("response" in guild) return guild.response;

    const targetEntry = await prisma.payoutEntry.findFirst({
        where: { id: entryId, discordGuildId: guild.resolved.guildId },
        select: { id: true },
    });

    if (!targetEntry) {
        return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const updates = payload.updates ?? {};
    const data: {
        wars?: number;
        races?: number;
        reviews?: number;
        bonus?: number;
        invasions?: number;
        vods?: number;
        isPaid?: boolean;
        displayName?: string;
    } = {};

    const numericFields: Array<"wars" | "races" | "reviews" | "bonus" | "invasions" | "vods"> = [
        "wars",
        "races",
        "reviews",
        "bonus",
        "invasions",
        "vods",
    ];

    try {
        for (const field of numericFields) {
            if (updates[field] !== undefined) {
                data[field] = parseNonNegativeInt(updates[field], field);
            }
        }
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Invalid numeric fields",
            },
            { status: 400 },
        );
    }

    if (updates.isPaid !== undefined) {
        if (typeof updates.isPaid !== "boolean") {
            return NextResponse.json({ error: "isPaid must be a boolean" }, { status: 400 });
        }
        data.isPaid = updates.isPaid;
    }

    if (updates.displayName !== undefined) {
        if (typeof updates.displayName !== "string") {
            return NextResponse.json({ error: "displayName must be a string" }, { status: 400 });
        }

        const trimmedDisplayName = updates.displayName.trim();
        if (!trimmedDisplayName) {
            return NextResponse.json({ error: "displayName cannot be empty" }, { status: 400 });
        }

        data.displayName = trimmedDisplayName;
    }

    const entry = await prisma.payoutEntry.update({
        where: { id: entryId },
        data,
    });

    publishLiveUpdate({ topic: "payout", guildId: guild.resolved.guildId });

    return NextResponse.json(entry);
});

// ─── DELETE : supprimer une entrée ───────────────────────────────────────────

export const DELETE = apiHandler("DELETE /api/payout/entries", async (request: NextRequest) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const payload = (await request.json()) as { entryId: string; guildId?: string };
    const entryId = payload.entryId?.trim();

    if (!entryId) {
        return NextResponse.json({ error: "entryId is required" }, { status: 400 });
    }

    const guild = await requireGuildAuth(auth.email, payload.guildId, "payout", "write");
    if ("response" in guild) return guild.response;

    const targetEntry = await prisma.payoutEntry.findFirst({
        where: { id: entryId, discordGuildId: guild.resolved.guildId },
        select: { id: true },
    });

    if (!targetEntry) {
        return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    await prisma.payoutEntry.delete({ where: { id: entryId } });

    publishLiveUpdate({ topic: "payout", guildId: guild.resolved.guildId });

    return NextResponse.json({ success: true });
});
