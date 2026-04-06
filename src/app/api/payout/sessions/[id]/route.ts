import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveManagedGuildForUser } from "@/lib/managed-guild-access";
import { NextRequest, NextResponse } from "next/server";

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

        const targetSession = await prisma.payoutSession.findFirst({
            where: { id, discordGuildId: resolved.guildId },
            select: { id: true },
        });

        if (!targetSession) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const payoutSession = await prisma.payoutSession.update({
            where: { id },
            data: {
                ...(payload.goldPool !== undefined && { goldPool: payload.goldPool }),
                ...(payload.status !== undefined && { status: payload.status }),
            },
            include: { entries: { orderBy: { displayName: "asc" } } },
        });

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
            select: { id: true },
        });

        if (!targetSession) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        await prisma.payoutSession.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/payout/sessions/[id]", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
