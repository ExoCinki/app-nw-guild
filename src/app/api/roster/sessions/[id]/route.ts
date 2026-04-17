import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishLiveUpdate } from "@/lib/live-updates";
import { apiHandler, requireAuth, requireGuildAuth } from "@/lib/route-guard";

type RouteParams = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export const GET = apiHandler(
    "GET /api/roster/sessions/[id]",
    async (request: NextRequest, { params }: RouteParams) => {
        const { id } = await params;

        const auth = await requireAuth();
        if ("response" in auth) return auth.response;

        const guild = await requireGuildAuth(auth.email, request.nextUrl.searchParams.get("guildId"), "roster");
        if ("response" in guild) return guild.response;

        const rosterSession = await prisma.roster.findFirst({
            where: { id, discordGuildId: guild.resolved.guildId },
            include: {
                groups: {
                    orderBy: [{ rosterIndex: "asc" }, { groupNumber: "asc" }],
                    include: { slots: { orderBy: { position: "asc" } } },
                },
                shares: { select: { shareUrl: true, updatedAt: true } },
            },
        });

        if (!rosterSession) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        return NextResponse.json(rosterSession);
    },
);

export const PATCH = apiHandler(
    "PATCH /api/roster/sessions/[id]",
    async (request: NextRequest, { params }: RouteParams) => {
        const { id } = await params;

        const auth = await requireAuth();
        if ("response" in auth) return auth.response;

        const payload = (await request.json().catch(() => ({}))) as {
            guildId?: string;
            name?: string | null;
            status?: string;
            isLocked?: boolean;
        };

        const guild = await requireGuildAuth(auth.email, payload.guildId ?? null, "roster", "write");
        if ("response" in guild) return guild.response;

        const targetSession = await prisma.roster.findFirst({
            where: { id, discordGuildId: guild.resolved.guildId },
            select: { id: true, isLocked: true, lockedByUserId: true },
        });

        if (!targetSession) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (
            payload.isLocked === false &&
            targetSession.isLocked &&
            targetSession.lockedByUserId !== guild.resolved.userId
        ) {
            return NextResponse.json(
                { error: "Only the user who locked this session can unlock it" },
                { status: 403 },
            );
        }

        const updated = await prisma.roster.update({
            where: { id },
            data: {
                ...(payload.name !== undefined && { name: payload.name?.trim() || null }),
                ...(payload.status !== undefined && { status: payload.status }),
                ...(payload.isLocked !== undefined && {
                    isLocked: payload.isLocked,
                    lockedByUserId: payload.isLocked ? guild.resolved.userId : null,
                }),
            },
            include: {
                shares: { select: { shareUrl: true, updatedAt: true } },
            },
        });

        publishLiveUpdate({ topic: "roster", guildId: guild.resolved.guildId });

        return NextResponse.json(updated);
    },
);

export const DELETE = apiHandler(
    "DELETE /api/roster/sessions/[id]",
    async (request: NextRequest, { params }: RouteParams) => {
        const { id } = await params;

        const auth = await requireAuth();
        if ("response" in auth) return auth.response;

        const guild = await requireGuildAuth(auth.email, request.nextUrl.searchParams.get("guildId"), "roster", "write");
        if ("response" in guild) return guild.response;

        const targetSession = await prisma.roster.findFirst({
            where: { id, discordGuildId: guild.resolved.guildId },
            select: { id: true, isLocked: true },
        });

        if (!targetSession) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (targetSession.isLocked) {
            return NextResponse.json(
                { error: "This roster session is locked and cannot be deleted" },
                { status: 403 },
            );
        }

        await prisma.roster.delete({ where: { id } });

        publishLiveUpdate({ topic: "roster", guildId: guild.resolved.guildId });

        return NextResponse.json({ success: true });
    },
);
