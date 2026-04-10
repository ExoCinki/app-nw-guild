import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishLiveUpdate } from "@/lib/live-updates";
import { withApiTiming } from "@/lib/api-timing";
import { apiHandler, requireAuth, requireGuildAuth } from "@/lib/route-guard";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

// ─── GET ──────────────────────────────────────────────────────────────────────

export const GET = apiHandler(
    "GET /api/payout/sessions/[id]",
    async (request: NextRequest, { params }: RouteParams) => {
        const { id } = await params;

        const auth = await requireAuth();
        if ("response" in auth) return auth.response;

        const guild = await requireGuildAuth(auth.email, request.nextUrl.searchParams.get("guildId"), "payout");
        if ("response" in guild) return guild.response;

        const payoutSession = await withApiTiming("GET /api/payout/sessions/[id]", () =>
            prisma.payoutSession.findFirst({
                where: { id, discordGuildId: guild.resolved.guildId },
                include: { entries: { orderBy: { displayName: "asc" } } },
            }),
        );

        if (!payoutSession) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        return NextResponse.json(payoutSession);
    },
);

// ─── PATCH ────────────────────────────────────────────────────────────────────

export const PATCH = apiHandler(
    "PATCH /api/payout/sessions/[id]",
    async (request: NextRequest, { params }: RouteParams) => {
        const { id } = await params;

        const auth = await requireAuth();
        if ("response" in auth) return auth.response;

        const payload = (await request.json()) as {
            goldPool?: number;
            status?: string;
            name?: string | null;
            isLocked?: boolean;
            guildId?: string;
        };

        const guild = await requireGuildAuth(auth.email, payload.guildId, "payout", "write");
        if ("response" in guild) return guild.response;

        const dbUser = await prisma.user.findUnique({
            where: { email: auth.email },
            select: { id: true },
        });

        if (!dbUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const targetSession = await prisma.payoutSession.findFirst({
            where: { id, discordGuildId: guild.resolved.guildId },
            select: { id: true, isLocked: true, lockedByUserId: true },
        });

        if (!targetSession) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (
            payload.isLocked === false &&
            targetSession.isLocked &&
            targetSession.lockedByUserId !== dbUser.id
        ) {
            return NextResponse.json(
                { error: "Only the user who locked this session can unlock it" },
                { status: 403 },
            );
        }

        const payoutSession = await withApiTiming("PATCH /api/payout/sessions/[id]", () =>
            prisma.payoutSession.update({
                where: { id },
                data: {
                    ...(payload.goldPool !== undefined && { goldPool: payload.goldPool }),
                    ...(payload.status !== undefined && { status: payload.status }),
                    ...(payload.name !== undefined && { name: payload.name }),
                    ...(payload.isLocked !== undefined && {
                        isLocked: payload.isLocked,
                        lockedByUserId: payload.isLocked ? dbUser.id : null,
                    }),
                },
                include: { entries: { orderBy: { displayName: "asc" } } },
            }),
        );

        publishLiveUpdate({ topic: "payout", guildId: guild.resolved.guildId });

        return NextResponse.json(payoutSession);
    },
);

// ─── DELETE ───────────────────────────────────────────────────────────────────

export const DELETE = apiHandler(
    "DELETE /api/payout/sessions/[id]",
    async (request: NextRequest, { params }: RouteParams) => {
        const { id } = await params;

        const auth = await requireAuth();
        if ("response" in auth) return auth.response;

        const guild = await requireGuildAuth(auth.email, request.nextUrl.searchParams.get("guildId"), "payout", "write");
        if ("response" in guild) return guild.response;

        const targetSession = await prisma.payoutSession.findFirst({
            where: { id, discordGuildId: guild.resolved.guildId },
            select: { id: true, isLocked: true },
        });

        if (!targetSession) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (targetSession.isLocked) {
            return NextResponse.json(
                { error: "This session is locked and cannot be deleted" },
                { status: 403 },
            );
        }

        await prisma.payoutSession.delete({ where: { id } });

        publishLiveUpdate({ topic: "payout", guildId: guild.resolved.guildId });

        return NextResponse.json({ success: true });
    },
);
