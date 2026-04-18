import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishLiveUpdate } from "@/lib/live-updates";
import { withApiTiming } from "@/lib/api-timing";
import { apiHandler, requireAuth, requireGuildAuth } from "@/lib/route-guard";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

// ─── GET : récupérer une session ──────────────────────────────────────────────

export const GET = apiHandler(
    "GET /api/scoreboard/sessions/[id]",
    async (request: NextRequest, { params }: RouteParams) => {
        const { id } = await params;

        const auth = await requireAuth();
        if ("response" in auth) return auth.response;

        const guild = await requireGuildAuth(auth.email, request.nextUrl.searchParams.get("guildId"), "scoreboard");
        if ("response" in guild) return guild.response;

        const scoreboardSession = await withApiTiming("GET /api/scoreboard/sessions/[id]", () =>
            prisma.scoreboardSession.findFirst({
                where: { id, discordGuildId: guild.resolved.guildId },
                include: {
                    entries: { orderBy: { playerName: "asc" } },
                    shares: { select: { shareUrl: true, updatedAt: true } },
                },
            }),
        );

        if (!scoreboardSession) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        return NextResponse.json(scoreboardSession);
    },
);

// ─── PATCH : modifier une session ────────────────────────────────────────────

export const PATCH = apiHandler(
    "PATCH /api/scoreboard/sessions/[id]",
    async (request: NextRequest, { params }: RouteParams) => {
        const { id } = await params;

        const auth = await requireAuth();
        if ("response" in auth) return auth.response;

        const payload = (await request.json()) as {
            name?: string | null;
            status?: string;
            guildId?: string;
        };

        const guild = await requireGuildAuth(auth.email, payload.guildId, "scoreboard", "write");
        if ("response" in guild) return guild.response;

        const targetSession = await prisma.scoreboardSession.findFirst({
            where: { id, discordGuildId: guild.resolved.guildId },
            select: { id: true },
        });

        if (!targetSession) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const scoreboardSession = await withApiTiming("PATCH /api/scoreboard/sessions/[id]", () =>
            prisma.scoreboardSession.update({
                where: { id },
                data: {
                    ...(payload.name !== undefined && { name: payload.name?.trim() || null }),
                    ...(payload.status !== undefined && { status: payload.status }),
                },
                include: {
                    entries: { orderBy: { playerName: "asc" } },
                    shares: { select: { shareUrl: true, updatedAt: true } },
                },
            }),
        );

        publishLiveUpdate({ topic: "scoreboard", guildId: guild.resolved.guildId });

        return NextResponse.json(scoreboardSession);
    },
);

// ─── DELETE : supprimer une session ──────────────────────────────────────────

export const DELETE = apiHandler(
    "DELETE /api/scoreboard/sessions/[id]",
    async (request: NextRequest, { params }: RouteParams) => {
        const { id } = await params;

        const auth = await requireAuth();
        if ("response" in auth) return auth.response;

        const guild = await requireGuildAuth(auth.email, request.nextUrl.searchParams.get("guildId"), "scoreboard", "write");
        if ("response" in guild) return guild.response;

        const targetSession = await prisma.scoreboardSession.findFirst({
            where: { id, discordGuildId: guild.resolved.guildId },
            select: { id: true },
        });

        if (!targetSession) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        await prisma.scoreboardSession.delete({ where: { id } });

        publishLiveUpdate({ topic: "scoreboard", guildId: guild.resolved.guildId });

        return NextResponse.json({ success: true });
    },
);
