import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishLiveUpdate } from "@/lib/live-updates";
import { apiHandler, requireAuth, requireGuildAuth } from "@/lib/route-guard";

export const dynamic = "force-dynamic";

function normalizePlayerNameKey(value: string) {
    return value.trim().toLowerCase();
}

function parseNonNegativeInt(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    const int = Math.trunc(value);
    return int < 0 ? null : int;
}

// ─── POST : créer une entrée ──────────────────────────────────────────────────

export const POST = apiHandler("POST /api/scoreboard/entries", async (request: NextRequest) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const payload = (await request.json()) as {
        sessionId: string;
        playerName: string;
        guildId?: string;
    };

    if (!payload.sessionId) {
        return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const playerName = payload.playerName?.trim();
    if (!playerName) {
        return NextResponse.json({ error: "playerName is required" }, { status: 400 });
    }

    const guild = await requireGuildAuth(auth.email, payload.guildId, "scoreboard", "write");
    if ("response" in guild) return guild.response;

    const targetSession = await prisma.scoreboardSession.findFirst({
        where: { id: payload.sessionId, discordGuildId: guild.resolved.guildId },
        select: { id: true },
    });

    if (!targetSession) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const entry = await prisma.scoreboardEntry.create({
        data: {
            sessionId: payload.sessionId,
            discordGuildId: guild.resolved.guildId,
            playerName,
            playerNameKey: normalizePlayerNameKey(playerName),
        },
    });

    publishLiveUpdate({ topic: "scoreboard", guildId: guild.resolved.guildId });

    return NextResponse.json(entry, { status: 201 });
});

// ─── PATCH : mettre à jour une entrée ────────────────────────────────────────

export const PATCH = apiHandler("PATCH /api/scoreboard/entries", async (request: NextRequest) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const payload = (await request.json()) as {
        entryId: string;
        updates?: {
            playerName?: string;
            kills?: number;
            deaths?: number;
            assists?: number;
            damageDealt?: number;
            healingDone?: number;
        };
        guildId?: string;
    };

    if (!payload.entryId) {
        return NextResponse.json({ error: "entryId is required" }, { status: 400 });
    }

    const guild = await requireGuildAuth(auth.email, payload.guildId, "scoreboard", "write");
    if ("response" in guild) return guild.response;

    const targetEntry = await prisma.scoreboardEntry.findFirst({
        where: { id: payload.entryId, discordGuildId: guild.resolved.guildId },
        select: { id: true },
    });

    if (!targetEntry) {
        return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const updates = payload.updates ?? {};
    const data: {
        playerName?: string;
        playerNameKey?: string;
        kills?: number;
        deaths?: number;
        assists?: number;
        damageDealt?: number;
        healingDone?: number;
    } = {};

    if (typeof updates.playerName === "string") {
        const trimmed = updates.playerName.trim();
        if (!trimmed) {
            return NextResponse.json({ error: "playerName cannot be empty" }, { status: 400 });
        }
        data.playerName = trimmed;
        data.playerNameKey = normalizePlayerNameKey(trimmed);
    }

    const statFields: Array<"kills" | "deaths" | "assists" | "damageDealt" | "healingDone"> = [
        "kills", "deaths", "assists", "damageDealt", "healingDone",
    ];

    for (const field of statFields) {
        if (updates[field] !== undefined) {
            const parsed = parseNonNegativeInt(updates[field]);
            if (parsed === null) {
                return NextResponse.json(
                    { error: `${field} must be a non-negative integer` },
                    { status: 400 },
                );
            }
            data[field] = parsed;
        }
    }

    const entry = await prisma.scoreboardEntry.update({
        where: { id: payload.entryId },
        data,
    });

    publishLiveUpdate({ topic: "scoreboard", guildId: guild.resolved.guildId });

    return NextResponse.json(entry);
});

// ─── DELETE : supprimer une entrée ───────────────────────────────────────────

export const DELETE = apiHandler("DELETE /api/scoreboard/entries", async (request: NextRequest) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const payload = (await request.json()) as { entryId: string; guildId?: string };

    if (!payload.entryId) {
        return NextResponse.json({ error: "entryId is required" }, { status: 400 });
    }

    const guild = await requireGuildAuth(auth.email, payload.guildId, "scoreboard", "write");
    if ("response" in guild) return guild.response;

    const targetEntry = await prisma.scoreboardEntry.findFirst({
        where: { id: payload.entryId, discordGuildId: guild.resolved.guildId },
        select: { id: true },
    });

    if (!targetEntry) {
        return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    await prisma.scoreboardEntry.delete({ where: { id: payload.entryId } });

    publishLiveUpdate({ topic: "scoreboard", guildId: guild.resolved.guildId });

    return NextResponse.json({ success: true });
});
