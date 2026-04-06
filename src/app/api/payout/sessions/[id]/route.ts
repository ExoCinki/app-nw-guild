import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";
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

        const guilds = await getManagedWhitelistedGuilds(session.user.email);
        if (!guilds || guilds.length === 0) {
            return NextResponse.json({ error: "No managed guilds" }, { status: 403 });
        }

        const guildId = guilds[0].id;

        const payoutSession = await prisma.payoutSession.findFirst({
            where: { id, discordGuildId: guildId },
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

        const guilds = await getManagedWhitelistedGuilds(session.user.email);
        if (!guilds || guilds.length === 0) {
            return NextResponse.json({ error: "No managed guilds" }, { status: 403 });
        }

        const guildId = guilds[0].id;
        const { goldPool, status } = await request.json();

        const payoutSession = await prisma.payoutSession.update({
            where: { id },
            data: {
                ...(goldPool !== undefined && { goldPool }),
                ...(status !== undefined && { status }),
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
