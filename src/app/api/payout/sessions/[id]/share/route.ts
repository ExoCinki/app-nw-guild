import { createHash, randomBytes } from "node:crypto";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { resolveManagedGuildForUser } from "@/lib/managed-guild-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const SHARE_LINK_TTL_DAYS = 30;

function createShareToken(): string {
    return randomBytes(32).toString("base64url");
}

function hashShareToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = (await request.json().catch(() => ({}))) as {
            guildId?: string;
        };

        const resolved = await resolveManagedGuildForUser(
            session.user.email,
            payload.guildId ?? null,
            "payout",
            "write",
        );

        if ("error" in resolved) {
            return NextResponse.json(
                { error: resolved.error },
                { status: resolved.status },
            );
        }

        const payoutSession = await prisma.payoutSession.findFirst({
            where: {
                id,
                discordGuildId: resolved.guildId,
            },
            select: {
                id: true,
            },
        });

        if (!payoutSession) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        const shareToken = createShareToken();
        const shareTokenHash = hashShareToken(shareToken);

        const share = await prisma.payoutSessionShare.upsert({
            where: { sessionId: payoutSession.id },
            update: {
                shareTokenHash,
                createdByUserId: resolved.userId,
            },
            create: {
                sessionId: payoutSession.id,
                discordGuildId: resolved.guildId,
                shareTokenHash,
                createdByUserId: resolved.userId,
            },
            select: {
                createdAt: true,
                updatedAt: true,
            },
        });

        return NextResponse.json({
            shareUrl: `${request.nextUrl.origin}/payout/shared/${shareToken}`,
            createdAt: share.createdAt,
            updatedAt: share.updatedAt,
            expiresAt: new Date(
                share.updatedAt.getTime() + SHARE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000,
            ),
        });
    } catch (error) {
        console.error("POST /api/payout/sessions/[id]/share", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = (await request.json().catch(() => ({}))) as {
            guildId?: string;
        };

        const resolved = await resolveManagedGuildForUser(
            session.user.email,
            payload.guildId ?? null,
            "payout",
            "write",
        );

        if ("error" in resolved) {
            return NextResponse.json(
                { error: resolved.error },
                { status: resolved.status },
            );
        }

        const payoutSession = await prisma.payoutSession.findFirst({
            where: {
                id,
                discordGuildId: resolved.guildId,
            },
            select: {
                id: true,
            },
        });

        if (!payoutSession) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        await prisma.payoutSessionShare.deleteMany({
            where: {
                sessionId: payoutSession.id,
                discordGuildId: resolved.guildId,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/payout/sessions/[id]/share", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
