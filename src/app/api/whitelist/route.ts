import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerSessionStatus } from "@/lib/whitelist-auth";

export const dynamic = "force-dynamic";

function ownerGuardResponse(status: "unauthorized" | "forbidden" | "misconfigured") {
    if (status === "unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (status === "forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
        { error: "OWNER_DISCORD_ID is not configured" },
        { status: 500 },
    );
}

export async function GET() {
    const ownerStatus = await getOwnerSessionStatus();
    if (ownerStatus.status !== "ok") {
        return ownerGuardResponse(ownerStatus.status);
    }

    const guilds = await prisma.whitelistedGuild.findMany({
        orderBy: { createdAt: "asc" },
        select: {
            discordGuildId: true,
            name: true,
            createdAt: true,
        },
    });

    return NextResponse.json({ guilds });
}

export async function POST(request: NextRequest) {
    const ownerStatus = await getOwnerSessionStatus();
    if (ownerStatus.status !== "ok") {
        return ownerGuardResponse(ownerStatus.status);
    }

    const payload = (await request.json().catch(() => null)) as {
        guildId?: string;
        name?: string;
    } | null;

    const guildId = payload?.guildId?.trim();
    const name = payload?.name?.trim();

    if (!guildId) {
        return NextResponse.json({ error: "guildId is required" }, { status: 400 });
    }

    const guild = await prisma.whitelistedGuild.upsert({
        where: { discordGuildId: guildId },
        update: {
            name: name || null,
            addedByUserId: ownerStatus.session.user.id,
        },
        create: {
            discordGuildId: guildId,
            name: name || null,
            addedByUserId: ownerStatus.session.user.id,
        },
        select: {
            discordGuildId: true,
            name: true,
            createdAt: true,
        },
    });

    return NextResponse.json({ guild });
}

export async function DELETE(request: NextRequest) {
    const ownerStatus = await getOwnerSessionStatus();
    if (ownerStatus.status !== "ok") {
        return ownerGuardResponse(ownerStatus.status);
    }

    const guildId = request.nextUrl.searchParams.get("guildId")?.trim();

    if (!guildId) {
        return NextResponse.json({ error: "guildId is required" }, { status: 400 });
    }

    await prisma.whitelistedGuild.deleteMany({
        where: { discordGuildId: guildId },
    });

    return NextResponse.json({ success: true });
}