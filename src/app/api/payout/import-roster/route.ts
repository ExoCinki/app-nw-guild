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
        const { sessionId } = await request.json();

        // Get the roster
        const roster = await prisma.roster.findUnique({
            where: { discordGuildId: guildId },
            include: {
                groups: {
                    include: {
                        slots: true,
                    },
                },
            },
        });

        if (!roster) {
            return NextResponse.json({ error: "No roster found" }, { status: 404 });
        }

        // Extract unique players from assigned slots
        const playerMap = new Map<
            string,
            { name: string; displayName: string; id: string }
        >();

        roster.groups.forEach((group: { slots: Array<{ playerName: string | null }> }) => {
            group.slots.forEach((slot: { playerName: string | null }) => {
                if (slot.playerName) {
                    if (!playerMap.has(slot.playerName)) {
                        playerMap.set(slot.playerName, {
                            name: slot.playerName,
                            displayName: slot.playerName,
                            id: "", // We don't have Discord ID from roster, will be empty
                        });
                    }
                }
            });
        });

        // Create entries for all players
        const entries = [];
        for (const [, player] of playerMap) {
            try {
                const entry = await prisma.payoutEntry.upsert({
                    where: {
                        sessionId_discordUserId: {
                            sessionId,
                            discordUserId: player.name, // Use name as ID since we don't have actual Discord ID
                        },
                    },
                    update: {}, // Don't update if already exists
                    create: {
                        sessionId,
                        discordGuildId: guildId,
                        discordUserId: player.name,
                        username: player.name,
                        displayName: player.displayName,
                    },
                });
                entries.push(entry);
            } catch (error) {
                console.error(`Error creating entry for ${player.name}:`, error);
            }
        }

        return NextResponse.json({
            imported: entries.length,
            entries,
        });
    } catch (error) {
        console.error("POST /api/payout/import-roster", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
