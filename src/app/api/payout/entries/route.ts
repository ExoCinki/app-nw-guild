import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveManagedGuildForUser } from "@/lib/managed-guild-access";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = (await request.json()) as {
            sessionId: string;
            discordUserId: string;
            username: string;
            displayName?: string;
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
            where: {
                id: payload.sessionId,
                discordGuildId: resolved.guildId,
            },
            select: { id: true },
        });

        if (!targetSession) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        const entry = await prisma.payoutEntry.create({
            data: {
                sessionId: payload.sessionId,
                discordGuildId: resolved.guildId,
                discordUserId: payload.discordUserId,
                username: payload.username,
                displayName: payload.displayName || payload.username,
            },
        });

        return NextResponse.json(entry, { status: 201 });
    } catch (error) {
        console.error("POST /api/payout/entries", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = (await request.json()) as {
            entryId: string;
            updates?: {
                wars?: number;
                races?: number;
                reviews?: number;
                bonus?: number;
                invasions?: number;
                vods?: number;
                isPaid?: boolean;
                displayName?: string;
            };
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

        const targetEntry = await prisma.payoutEntry.findFirst({
            where: {
                id: payload.entryId,
                discordGuildId: resolved.guildId,
            },
            select: { id: true },
        });

        if (!targetEntry) {
            return NextResponse.json({ error: "Entry not found" }, { status: 404 });
        }

        const entry = await prisma.payoutEntry.update({
            where: { id: payload.entryId },
            data: payload.updates || {},
        });

        return NextResponse.json(entry);
    } catch (error) {
        console.error("PATCH /api/payout/entries", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = (await request.json()) as {
            entryId: string;
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

        const targetEntry = await prisma.payoutEntry.findFirst({
            where: {
                id: payload.entryId,
                discordGuildId: resolved.guildId,
            },
            select: { id: true },
        });

        if (!targetEntry) {
            return NextResponse.json({ error: "Entry not found" }, { status: 404 });
        }

        await prisma.payoutEntry.delete({
            where: { id: payload.entryId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/payout/entries", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
