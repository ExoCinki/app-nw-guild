import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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
        const { sessionId, discordUserId, username, displayName } =
            await request.json();

        const entry = await prisma.payoutEntry.create({
            data: {
                sessionId,
                discordGuildId: guildId,
                discordUserId,
                username,
                displayName: displayName || username,
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

        const guilds = await getManagedWhitelistedGuilds(session.user.email);
        if (!guilds || guilds.length === 0) {
            return NextResponse.json({ error: "No managed guilds" }, { status: 403 });
        }

        const { entryId, updates } = await request.json();

        const entry = await prisma.payoutEntry.update({
            where: { id: entryId },
            data: updates || {},
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

        const guilds = await getManagedWhitelistedGuilds(session.user.email);
        if (!guilds || guilds.length === 0) {
            return NextResponse.json({ error: "No managed guilds" }, { status: 403 });
        }

        const { entryId } = await request.json();

        await prisma.payoutEntry.delete({
            where: { id: entryId },
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
