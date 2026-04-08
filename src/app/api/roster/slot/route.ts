import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";
import { hasGuildScopeAccess, type GuildAccessMode } from "@/lib/admin-access";
import { publishLiveUpdate } from "@/lib/live-updates";

export const dynamic = "force-dynamic";

const PRIMARY_ROSTER_INDEX = 1;
const SECONDARY_ROSTER_INDEX = 2;

function normalizePlayerKey(value: string | null | undefined) {
    return value?.trim().toLowerCase() ?? "";
}

async function resolveGuildForUser(
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

    const canAccessRoster = await hasGuildScopeAccess({
        userId: user.id,
        discordGuildId: guildId,
        scope: "roster",
        mode,
        isOwner,
    });

    if (!canAccessRoster) {
        return { error: "Access denied for roster module on this server", status: 403 as const };
    }

    const guildName =
        manageableGuilds.find((guild) => guild.id === guildId)?.name ?? null;

    return { userId: user.id, guildId, guildName };
}

/**
 * PUT /api/roster/slot
 *
 * Lightweight endpoint for updating a single roster slot.
 * Returns only the modified slot, not the entire roster.
 */
export async function PUT(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as {
        guildId?: string;
        rosterIndex?: number;
        groupNumber: number;
        slotPosition: number;
        playerName: string | null;
        role: string | null;
    };

    // Validate groupNumber
    if (!Number.isInteger(payload.groupNumber) || payload.groupNumber < 1 || payload.groupNumber > 10) {
        return NextResponse.json(
            { error: "groupNumber must be between 1 and 10" },
            { status: 400 },
        );
    }

    // Validate slotPosition
    if (!Number.isInteger(payload.slotPosition) || payload.slotPosition < 1 || payload.slotPosition > 5) {
        return NextResponse.json(
            { error: "slotPosition must be between 1 and 5" },
            { status: 400 },
        );
    }

    const resolved = await resolveGuildForUser(
        session.user.email,
        payload.guildId ?? null,
        "write",
    );

    if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const rosterIndex = payload.rosterIndex ?? PRIMARY_ROSTER_INDEX;

    if (rosterIndex !== PRIMARY_ROSTER_INDEX && rosterIndex !== SECONDARY_ROSTER_INDEX) {
        return NextResponse.json(
            { error: "rosterIndex must be either 1 or 2" },
            { status: 400 },
        );
    }

    // Check if second roster is enabled
    const guildConfiguration = await prisma.guildConfiguration.findUnique({
        where: { discordGuildId: resolved.guildId },
        select: { enableSecondRoster: true },
    });

    const enableSecondRoster = guildConfiguration?.enableSecondRoster ?? false;

    if (rosterIndex === SECONDARY_ROSTER_INDEX && !enableSecondRoster) {
        return NextResponse.json(
            { error: "Second roster is not enabled for this server" },
            { status: 400 },
        );
    }

    // Get or create roster
    const roster = await prisma.roster.findUnique({
        where: { discordGuildId: resolved.guildId },
        select: { id: true },
    });

    if (!roster) {
        return NextResponse.json({ error: "Roster not found" }, { status: 404 });
    }

    // If adding a player, check for conflicts in the other roster
    if (payload.playerName?.trim()) {
        const otherRosterIndex =
            rosterIndex === PRIMARY_ROSTER_INDEX
                ? SECONDARY_ROSTER_INDEX
                : PRIMARY_ROSTER_INDEX;

        const conflictingSlot = await prisma.rosterSlot.findFirst({
            where: {
                group: {
                    roster: { id: roster.id },
                    rosterIndex: otherRosterIndex,
                },
                playerName: { not: null },
            },
            select: { playerName: true },
        });

        if (
            conflictingSlot &&
            normalizePlayerKey(conflictingSlot.playerName) === normalizePlayerKey(payload.playerName)
        ) {
            return NextResponse.json(
                {
                    error: `Player "${payload.playerName}" is already assigned in roster ${otherRosterIndex}`,
                },
                { status: 409 }, // Conflict
            );
        }
    }

    // Get or create the group
    const group = await prisma.rosterGroup.findUnique({
        where: {
            rosterId_rosterIndex_groupNumber: {
                rosterId: roster.id,
                rosterIndex,
                groupNumber: payload.groupNumber,
            },
        },
        select: { id: true },
    });

    if (!group) {
        // Create the group if it doesn't exist
        const newGroup = await prisma.rosterGroup.create({
            data: {
                rosterId: roster.id,
                rosterIndex,
                groupNumber: payload.groupNumber,
                name: null,
            },
            select: { id: true },
        });

        // Create all empty slots
        await Promise.all(
            Array.from({ length: 5 }, (_, i) =>
                prisma.rosterSlot.create({
                    data: {
                        groupId: newGroup.id,
                        position: i + 1,
                        playerName: i + 1 === payload.slotPosition ? payload.playerName?.trim() || null : null,
                        role:
                            i + 1 === payload.slotPosition && payload.playerName?.trim()
                                ? payload.role || null
                                : null,
                    },
                }),
            ),
        );
    } else {
        // Update only the specific slot
        await prisma.rosterSlot.update({
            where: {
                groupId_position: {
                    groupId: group.id,
                    position: payload.slotPosition,
                },
            },
            data: {
                playerName: payload.playerName?.trim() || null,
                role: payload.playerName?.trim() ? payload.role || null : null,
            },
        });
    }

    publishLiveUpdate({ topic: "roster", guildId: resolved.guildId });

    return NextResponse.json({
        slot: {
            rosterIndex,
            groupNumber: payload.groupNumber,
            slotPosition: payload.slotPosition,
            playerName: payload.playerName?.trim() || null,
            role: payload.playerName?.trim() ? payload.role || null : null,
        },
    });
}
