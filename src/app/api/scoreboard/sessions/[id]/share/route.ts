import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, requireAuth, requireGuildAuth } from "@/lib/route-guard";

export const dynamic = "force-dynamic";

const SHARE_LINK_TTL_DAYS = 30;

type RouteParams = { params: Promise<{ id: string }> };

function createShareToken(): string {
    return randomBytes(32).toString("hex");
}

function hashShareToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

export const POST = apiHandler(
    "POST /api/scoreboard/sessions/[id]/share",
    async (request: NextRequest, { params }: RouteParams) => {
        const { id } = await params;

        const auth = await requireAuth();
        if ("response" in auth) return auth.response;

        const payload = (await request.json().catch(() => ({}))) as { guildId?: string };

        const guild = await requireGuildAuth(auth.email, payload.guildId, "scoreboard", "write");
        if ("response" in guild) return guild.response;

        const scoreboardSession = await prisma.scoreboardSession.findFirst({
            where: { id, discordGuildId: guild.resolved.guildId },
            select: { id: true },
        });

        if (!scoreboardSession) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        const shareToken = createShareToken();
        const shareTokenHash = hashShareToken(shareToken);
        const shareUrl = `${request.nextUrl.origin}/scoreboard/shared/${shareToken}`;

        const share = await prisma.scoreboardSessionShare.upsert({
            where: { sessionId: scoreboardSession.id },
            update: { shareTokenHash, shareUrl, createdByUserId: guild.resolved.userId },
            create: {
                sessionId: scoreboardSession.id,
                discordGuildId: guild.resolved.guildId,
                shareTokenHash,
                shareUrl,
                createdByUserId: guild.resolved.userId,
            },
            select: { createdAt: true, updatedAt: true },
        });

        return NextResponse.json({
            sessionId: scoreboardSession.id,
            shareUrl,
            createdAt: share.createdAt,
            updatedAt: share.updatedAt,
            expiresAt: new Date(share.updatedAt.getTime() + SHARE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000),
        });
    },
);

export const DELETE = apiHandler(
    "DELETE /api/scoreboard/sessions/[id]/share",
    async (request: NextRequest, { params }: RouteParams) => {
        const { id } = await params;

        const auth = await requireAuth();
        if ("response" in auth) return auth.response;

        const payload = (await request.json().catch(() => ({}))) as { guildId?: string };

        const guild = await requireGuildAuth(auth.email, payload.guildId, "scoreboard", "write");
        if ("response" in guild) return guild.response;

        const scoreboardSession = await prisma.scoreboardSession.findFirst({
            where: { id, discordGuildId: guild.resolved.guildId },
            select: { id: true },
        });

        if (!scoreboardSession) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        await prisma.scoreboardSessionShare.deleteMany({
            where: {
                sessionId: scoreboardSession.id,
                discordGuildId: guild.resolved.guildId,
            },
        });

        return NextResponse.json({ success: true });
    },
);
