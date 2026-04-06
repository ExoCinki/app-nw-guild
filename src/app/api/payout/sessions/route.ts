import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveManagedGuildForUser } from "@/lib/managed-guild-access";
import { NextRequest, NextResponse } from "next/server";
import { publishLiveUpdate } from "@/lib/live-updates";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
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

        const sessions = await prisma.payoutSession.findMany({
            where: { discordGuildId: resolved.guildId },
            include: { entries: { orderBy: { displayName: "asc" } } },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(sessions);
    } catch (error) {
        console.error("GET /api/payout/sessions", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = (await request.json()) as {
            goldPool?: number;
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

        const payoutSession = await prisma.payoutSession.create({
            data: {
                discordGuildId: resolved.guildId,
                goldPool: payload.goldPool || 0,
            },
        });

        publishLiveUpdate({ topic: "payout", guildId: resolved.guildId });

        return NextResponse.json(payoutSession, { status: 201 });
    } catch (error) {
        console.error("POST /api/payout/sessions", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
