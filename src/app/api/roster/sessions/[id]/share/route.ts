import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, requireAuth, requireGuildAuth } from "@/lib/route-guard";

type RouteParams = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

function buildShareUrl(token: string) {
    const appBaseUrl =
        process.env.NEXTAUTH_URL ??
        process.env.NEXT_PUBLIC_APP_URL ??
        "http://localhost:3000";

    return `${appBaseUrl.replace(/\/$/, "")}/roster/shared/${token}`;
}

function createShareToken() {
    return randomBytes(32).toString("hex");
}

function hashShareToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
}

export const POST = apiHandler(
    "POST /api/roster/sessions/[id]/share",
    async (request: NextRequest, { params }: RouteParams) => {
        const { id } = await params;

        const auth = await requireAuth();
        if ("response" in auth) return auth.response;

        const guild = await requireGuildAuth(auth.email, request.nextUrl.searchParams.get("guildId"), "roster", "write");
        if ("response" in guild) return guild.response;

        const rosterSession = await prisma.roster.findFirst({
            where: { id, discordGuildId: guild.resolved.guildId },
            select: { id: true },
        });

        if (!rosterSession) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const token = createShareToken();
        const shareTokenHash = hashShareToken(token);
        const shareUrl = buildShareUrl(token);

        const share = await prisma.rosterSessionShare.upsert({
            where: { sessionId: rosterSession.id },
            update: {
                shareTokenHash,
                shareUrl,
                createdByUserId: guild.resolved.userId,
            },
            create: {
                sessionId: rosterSession.id,
                discordGuildId: guild.resolved.guildId,
                shareTokenHash,
                shareUrl,
                createdByUserId: guild.resolved.userId,
            },
            select: {
                shareUrl: true,
                updatedAt: true,
            },
        });

        return NextResponse.json(share);
    },
);

export const DELETE = apiHandler(
    "DELETE /api/roster/sessions/[id]/share",
    async (request: NextRequest, { params }: RouteParams) => {
        const { id } = await params;

        const auth = await requireAuth();
        if ("response" in auth) return auth.response;

        const guild = await requireGuildAuth(auth.email, request.nextUrl.searchParams.get("guildId"), "roster", "write");
        if ("response" in guild) return guild.response;

        const rosterSession = await prisma.roster.findFirst({
            where: { id, discordGuildId: guild.resolved.guildId },
            select: { id: true, shares: { select: { id: true } } },
        });

        if (!rosterSession) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        await prisma.rosterSessionShare.deleteMany({
            where: { sessionId: rosterSession.id, discordGuildId: guild.resolved.guildId },
        });

        return NextResponse.json({ success: true });
    },
);
