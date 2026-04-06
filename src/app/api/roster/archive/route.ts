import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";

export const dynamic = "force-dynamic";

async function resolveAdminGuild(email: string, guildIdFromQuery: string | null) {
    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
    });

    if (!user) {
        return { error: "User not found", status: 404 as const };
    }

    const manageableGuilds = await getManagedWhitelistedGuilds(email);

    if (!manageableGuilds) {
        return { error: "No Discord token found", status: 401 as const };
    }

    let guildId = guildIdFromQuery;

    if (!guildId) {
        const selectedGuild = await prisma.selectedGuild.findUnique({
            where: { userId: user.id },
            select: { discordGuildId: true },
        });
        guildId = selectedGuild?.discordGuildId ?? null;
    }

    if (!guildId) {
        return { error: "No guild selected", status: 400 as const };
    }

    const hasAccess = manageableGuilds.some((guild) => guild.id === guildId);

    if (!hasAccess) {
        return { error: "Guild is not manageable for this account", status: 403 as const };
    }

    // Check if user is admin (has admin role => TODO: verify admin status properly)
    // For now, accepting all who can manage the guild
    return { userId: user.id, guildId, isAdmin: true };
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolved = await resolveAdminGuild(session.user.email, null);

    if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    if (!resolved.isAdmin) {
        return NextResponse.json(
            { error: "You must be an admin to archive the roster" },
            { status: 403 },
        );
    }

    // Get current roster state + selected event
    const roster = await prisma.roster.findUnique({
        where: { discordGuildId: resolved.guildId },
        select: {
            selectedEventId: true,
            groups: {
                select: {
                    groupNumber: true,
                    name: true,
                    slots: {
                        select: { position: true, playerName: true, role: true },
                    },
                },
                orderBy: { groupNumber: "asc" },
            },
        },
    });

    if (!roster) {
        return NextResponse.json({ error: "Roster not found" }, { status: 404 });
    }

    // Get event title if eventId exists
    let eventTitle: string | null = null;

    if (roster.selectedEventId) {
        // Try to get the event from cache
        const rosterWithCache = await prisma.roster.findUnique({
            where: { discordGuildId: resolved.guildId },
            select: { raidHelperEventsCache: true },
        });

        if (rosterWithCache?.raidHelperEventsCache && Array.isArray(rosterWithCache.raidHelperEventsCache)) {
            const event = (rosterWithCache.raidHelperEventsCache as unknown[]).find(
                (e: unknown) => typeof e === "object" && e !== null && (e as Record<string, unknown>).id === roster.selectedEventId,
            );

            if (event && typeof event === "object" && "title" in event && typeof event.title === "string") {
                eventTitle = event.title;
            }
        }
    }

    // Archive the snapshot
    const archive = await prisma.rosterArchive.create({
        data: {
            discordGuildId: resolved.guildId,
            eventId: roster.selectedEventId ?? null,
            eventTitle: eventTitle,
            snapshot: roster as Prisma.InputJsonValue,
        },
    });

    return NextResponse.json({
        success: true,
        archiveId: archive.id,
        message: "Roster archived successfully",
    });
}

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolved = await resolveAdminGuild(session.user.email, null);

    if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    if (!resolved.isAdmin) {
        return NextResponse.json(
            { error: "You must be an admin to view archives" },
            { status: 403 },
        );
    }

    const archives = await prisma.rosterArchive.findMany({
        where: { discordGuildId: resolved.guildId },
        select: {
            id: true,
            eventId: true,
            eventTitle: true,
            archivedAt: true,
        },
        orderBy: { archivedAt: "desc" },
    });

    return NextResponse.json({ archives });
}
