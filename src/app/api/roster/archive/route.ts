import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";
import { hasGuildScopeAccess, type GuildAccessMode } from "@/lib/admin-access";
import { resolveRosterSession } from "@/lib/roster-session";

type RosterArchiveCreateInput = Parameters<typeof prisma.rosterArchive.create>[0]["data"];

export const dynamic = "force-dynamic";

async function resolveAdminGuild(
    email: string,
    guildIdFromQuery: string | null,
    mode: GuildAccessMode,
) {
    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, discordId: true },
    });

    if (!user) {
        return { error: "User not found", status: 404 as const };
    }

    const manageableGuildsResult = await getManagedWhitelistedGuilds(email);

    if (!manageableGuildsResult.ok) {
        return { error: manageableGuildsResult.error, status: manageableGuildsResult.status };
    }

    const manageableGuilds = manageableGuildsResult.guilds;

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

    const ownerDiscordId = process.env.OWNER_DISCORD_ID;
    const isOwner = Boolean(
        ownerDiscordId && user.discordId && user.discordId === ownerDiscordId,
    );

    const canAccessArchives = await hasGuildScopeAccess({
        userId: user.id,
        discordGuildId: guildId,
        scope: "archives",
        mode,
        isOwner,
    });

    if (!canAccessArchives) {
        return { error: "Access denied for archives module on this server", status: 403 as const };
    }

    return { userId: user.id, guildId, isAdmin: true };
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const requestedGuildId = url.searchParams.get("guildId");
    const body = (await request.json().catch(() => ({}))) as { sessionId?: string };

    const resolved = await resolveAdminGuild(session.user.email, requestedGuildId, "write");

    if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    if (!resolved.isAdmin) {
        return NextResponse.json(
            { error: "You must be an admin to archive the roster" },
            { status: 403 },
        );
    }

    const rosterSession = await resolveRosterSession({
        guildId: resolved.guildId,
        userId: resolved.userId,
        rosterSessionId: body.sessionId ?? url.searchParams.get("sessionId"),
        createIfMissing: true,
    });

    if (!rosterSession) {
        return NextResponse.json({ error: "Roster session not found" }, { status: 404 });
    }

    if (rosterSession.isLocked && rosterSession.lockedByUserId && rosterSession.lockedByUserId !== resolved.userId) {
        return NextResponse.json(
            { error: "This roster session is locked by another user" },
            { status: 403 },
        );
    }

    const roster = await prisma.roster.findUnique({
        where: { id: rosterSession.id },
        select: {
            id: true,
            selectedEventId: true,
            groups: {
                select: {
                    rosterIndex: true,
                    groupNumber: true,
                    name: true,
                    slots: {
                        select: { position: true, playerName: true, role: true },
                    },
                },
                orderBy: [{ rosterIndex: "asc" }, { groupNumber: "asc" }],
            },
            raidHelperEventsCache: true,
            name: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    if (!roster) {
        return NextResponse.json({ error: "Roster session not found" }, { status: 404 });
    }

    let eventTitle: string | null = null;

    if (roster.selectedEventId && Array.isArray(roster.raidHelperEventsCache)) {
        const event = (roster.raidHelperEventsCache as unknown[]).find(
            (e: unknown) => typeof e === "object" && e !== null && (e as Record<string, unknown>).id === roster.selectedEventId,
        );

        if (event && typeof event === "object" && "title" in event && typeof event.title === "string") {
            eventTitle = event.title;
        }
    }

    const archive = await prisma.rosterArchive.create({
        data: {
            rosterId: roster.id,
            discordGuildId: resolved.guildId,
            eventId: roster.selectedEventId ?? null,
            eventTitle,
            snapshot: roster as unknown as RosterArchiveCreateInput["snapshot"],
        },
    });

    await prisma.roster.update({
        where: { id: roster.id },
        data: { status: "ARCHIVED" },
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

    const url = new URL(request.url);
    const requestedGuildId = url.searchParams.get("guildId");

    const resolved = await resolveAdminGuild(session.user.email, requestedGuildId, "read");

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
            rosterId: true,
            eventId: true,
            eventTitle: true,
            archivedAt: true,
        },
        orderBy: { archivedAt: "desc" },
    });

    return NextResponse.json({ archives });
}
