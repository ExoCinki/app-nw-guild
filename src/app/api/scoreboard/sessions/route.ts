import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishLiveUpdate } from "@/lib/live-updates";
import { withApiTiming } from "@/lib/api-timing";
import { apiHandler, requireAuth, requireGuildAuth } from "@/lib/route-guard";

export const dynamic = "force-dynamic";

export const GET = apiHandler("GET /api/scoreboard/sessions", async (request: NextRequest) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const guild = await requireGuildAuth(auth.email, request.nextUrl.searchParams.get("guildId"), "scoreboard");
    if ("response" in guild) return guild.response;

    const sessions = await withApiTiming("GET /api/scoreboard/sessions", () =>
        prisma.scoreboardSession.findMany({
            where: { discordGuildId: guild.resolved.guildId },
            include: { entries: { orderBy: { playerName: "asc" } } },
            orderBy: { createdAt: "desc" },
        }),
    );

    return NextResponse.json(sessions);
});

export const POST = apiHandler("POST /api/scoreboard/sessions", async (request: NextRequest) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const payload = (await request.json()) as { name?: string | null; guildId?: string };

    const guild = await requireGuildAuth(auth.email, payload.guildId, "scoreboard", "write");
    if ("response" in guild) return guild.response;

    const scoreboardSession = await prisma.scoreboardSession.create({
        data: {
            discordGuildId: guild.resolved.guildId,
            name: payload.name?.trim() || null,
        },
        include: { entries: { orderBy: { playerName: "asc" } } },
    });

    publishLiveUpdate({ topic: "scoreboard", guildId: guild.resolved.guildId });

    return NextResponse.json(scoreboardSession, { status: 201 });
});
