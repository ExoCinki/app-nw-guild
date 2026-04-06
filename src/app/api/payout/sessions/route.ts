import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const guilds = await getManagedWhitelistedGuilds(session.user.email);
        if (!guilds || guilds.length === 0) {
            return NextResponse.json({ error: "No managed guilds" }, { status: 403 });
        }

        const guildId = guilds[0].id;

        const sessions = await prisma.payoutSession.findMany({
            where: { discordGuildId: guildId },
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

        const guilds = await getManagedWhitelistedGuilds(session.user.email);
        if (!guilds || guilds.length === 0) {
            return NextResponse.json({ error: "No managed guilds" }, { status: 403 });
        }

        const guildId = guilds[0].id;
        const { goldPool } = await request.json();

        const payoutSession = await prisma.payoutSession.create({
            data: {
                discordGuildId: guildId,
                goldPool: goldPool || 0,
            },
        });

        return NextResponse.json(payoutSession, { status: 201 });
    } catch (error) {
        console.error("POST /api/payout/sessions", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
