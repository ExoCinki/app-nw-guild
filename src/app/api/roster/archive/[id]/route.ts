import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";

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

    return NextResponse.json({ archive });
}
