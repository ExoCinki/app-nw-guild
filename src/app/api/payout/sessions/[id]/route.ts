import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveManagedGuildForUser } from "@/lib/managed-guild-access";
import { NextRequest, NextResponse } from "next/server";
import { publishLiveUpdate } from "@/lib/live-updates";

export const dynamic = "force-dynamic";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const requestedGuildId = request.nextUrl.searchParams.get("guildId");
        const resolved = await resolveManagedGuildForUser(
            session.user.email,
            requestedGuildId,
        );

        if ("error" in resolved) {
            return NextResponse.json(
                { error: resolved.error },
                { status: resolved.status },
            );
        }

        const payoutSession = await prisma.payoutSession.findFirst({
            where: { id, discordGuildId: resolved.guildId },
            include: { entries: { orderBy: { displayName: "asc" } } },
        });

        if (!payoutSession) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        return NextResponse.json(payoutSession);
    } catch (error) {
        console.error("GET /api/payout/sessions/[id]", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = (await request.json()) as {
            goldPool?: number;
            status?: string;
            name?: string | null;
            isLocked?: boolean;
            guildId?: string;
        };

        const resolved = await resolveManagedGuildForUser(
            session.user.email,
            payload.guildId ?? null,
        );

        if ("error" in resolved) {
            return NextResponse.json(
                { error: resolved.error },
                { status: resolved.status },
            );
        }

        const dbUser = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });

        if (!dbUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const targetSession = await prisma.payoutSession.findFirst({
            where: { id, discordGuildId: resolved.guildId },
            select: { id: true, isLocked: true, lockedByUserId: true },
        });

        if (!targetSession) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (payload.isLocked === false && targetSession.isLocked && targetSession.lockedByUserId !== dbUser.id) {
            return NextResponse.json(
                { error: "Seul l'utilisateur qui a verrouillé cette session peut la déverrouiller" },
                { status: 403 },
            );
        }

        const payoutSession = await prisma.payoutSession.update({
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
        });

        publishLiveUpdate({ topic: "payout", guildId: resolved.guildId });

        return NextResponse.json(payoutSession);
    } catch (error) {
        console.error("PATCH /api/payout/sessions/[id]", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const requestedGuildId = request.nextUrl.searchParams.get("guildId");
        const resolved = await resolveManagedGuildForUser(
            session.user.email,
            requestedGuildId,
        );

        if ("error" in resolved) {
            return NextResponse.json(
                { error: resolved.error },
                { status: resolved.status },
            );
        }

        const targetSession = await prisma.payoutSession.findFirst({
            where: { id, discordGuildId: resolved.guildId },
            select: { id: true, isLocked: true },
        });

        if (!targetSession) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (targetSession.isLocked) {
            return NextResponse.json(
                { error: "Cette session est verrouillée et ne peut pas être supprimée" },
                { status: 403 },
            );
        }

        await prisma.payoutSession.delete({
            where: { id },
        });

        publishLiveUpdate({ topic: "payout", guildId: resolved.guildId });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/payout/sessions/[id]", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
