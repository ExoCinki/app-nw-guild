import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";
import { hasGuildScopeAccess } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify user can access this guild
    const manageableGuildsResult = await getManagedWhitelistedGuilds(session.user.email);

    if (!manageableGuildsResult.ok) {
        return NextResponse.json(
            { error: manageableGuildsResult.error },
            { status: manageableGuildsResult.status },
        );
    }

    const manageableGuilds = manageableGuildsResult.guilds;
    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, discordId: true },
    });

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get archive
    const archive = await prisma.rosterArchive.findUnique({
        where: { id },
    });

    if (!archive) {
        return NextResponse.json({ error: "Archive not found" }, { status: 404 });
    }

    // Verify user can access this guild
    const hasAccess = manageableGuilds.some((g) => g.id === archive.discordGuildId);

    if (!hasAccess) {
        return NextResponse.json(
            { error: "You don't have access to this guild" },
            { status: 403 },
        );
    }

    const ownerDiscordId = process.env.OWNER_DISCORD_ID;
    const isOwner = Boolean(
        ownerDiscordId && user.discordId && user.discordId === ownerDiscordId,
    );

    const canAccessRoster = await hasGuildScopeAccess({
        userId: user.id,
        discordGuildId: archive.discordGuildId,
        scope: "archives",
        mode: "read",
        isOwner,
    });

    if (!canAccessRoster) {
        return NextResponse.json(
            { error: "Access denied for archives module on this server" },
            { status: 403 },
        );
    }

    return NextResponse.json({ archive });
}
