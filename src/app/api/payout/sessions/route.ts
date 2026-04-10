import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishLiveUpdate } from "@/lib/live-updates";
import { withApiTiming } from "@/lib/api-timing";
import { apiHandler, requireAuth, requireGuildAuth } from "@/lib/route-guard";

export const dynamic = "force-dynamic";

export const GET = apiHandler("GET /api/payout/sessions", async (request: NextRequest) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const guild = await requireGuildAuth(auth.email, request.nextUrl.searchParams.get("guildId"), "payout");
    if ("response" in guild) return guild.response;

    const sessions = await withApiTiming("GET /api/payout/sessions", () =>
        prisma.payoutSession.findMany({
            where: { discordGuildId: guild.resolved.guildId },
            include: {
                entries: { orderBy: { displayName: "asc" } },
                shares: { select: { shareUrl: true, updatedAt: true } },
            },
            orderBy: { createdAt: "desc" },
        }),
    );

    return NextResponse.json(sessions);
});

export const POST = apiHandler("POST /api/payout/sessions", async (request: NextRequest) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const payload = (await request.json()) as { goldPool?: number; guildId?: string };

    const guild = await requireGuildAuth(auth.email, payload.guildId, "payout", "write");
    if ("response" in guild) return guild.response;

    const payoutSession = await prisma.payoutSession.create({
        data: {
            discordGuildId: guild.resolved.guildId,
            goldPool: payload.goldPool || 0,
        },
    });

    publishLiveUpdate({ topic: "payout", guildId: guild.resolved.guildId });

    return NextResponse.json(payoutSession, { status: 201 });
});
