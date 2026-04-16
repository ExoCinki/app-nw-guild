import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";
import { hasGuildScopeAccess } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

async function resolveGuild(
    email: string,
    guildIdFromQuery: string | null,
    mode: "read" | "write",
) {
    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, discordId: true },
    });
    if (!user) return { error: "User not found", status: 404 as const };

    const manageableGuildsResult = await getManagedWhitelistedGuilds(email);
    if (!manageableGuildsResult.ok)
        return {
            error: manageableGuildsResult.error,
            status: manageableGuildsResult.status,
        };

    let guildId = guildIdFromQuery;
    if (!guildId) {
        const selectedGuild = await prisma.selectedGuild.findUnique({
            where: { userId: user.id },
            select: { discordGuildId: true },
        });
        guildId = selectedGuild?.discordGuildId ?? null;
    }
    if (!guildId) return { error: "No guild selected", status: 400 as const };

    const hasAccess = manageableGuildsResult.guilds.some((g) => g.id === guildId);
    if (!hasAccess)
        return { error: "Access denied", status: 403 as const };

    const ownerDiscordId = process.env.OWNER_DISCORD_ID;
    const isOwner = Boolean(
        ownerDiscordId && user.discordId && user.discordId === ownerDiscordId,
    );

    const canAccess = await hasGuildScopeAccess({
        userId: user.id,
        discordGuildId: guildId,
        scope: "roster",
        mode,
        isOwner,
    });
    if (!canAccess) return { error: "Access denied for roster", status: 403 as const };

    return { userId: user.id, guildId };
}

// GET /api/roster/participant-overrides?eventId=xxx
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const guildIdFromQuery = searchParams.get("guildId");

    if (!eventId)
        return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

    const resolved = await resolveGuild(session.user.email, guildIdFromQuery, "read");
    if ("error" in resolved)
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });

    const overrides = await prisma.rosterParticipantOverride.findMany({
        where: { discordGuildId: resolved.guildId, eventId },
        select: {
            participantKey: true,
            nameOverride: true,
            roleOverride: true,
            isMerc: true,
        },
    });

    return NextResponse.json({ overrides });
}

// PUT /api/roster/participant-overrides
// Body: { eventId, overrides: { participantKey, nameOverride?, roleOverride?, isMerc? }[] }
export async function PUT(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as {
        eventId?: string;
        guildId?: string;
        overrides?: {
            participantKey: string;
            nameOverride?: string | null;
            roleOverride?: string | null;
            isMerc?: boolean;
        }[];
    };

    if (!body.eventId || !Array.isArray(body.overrides))
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const resolved = await resolveGuild(
        session.user.email,
        body.guildId ?? null,
        "write",
    );
    if ("error" in resolved)
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });

    // Upsert all provided overrides, delete ones that are now empty
    await Promise.all(
        body.overrides.map((o) => {
            const isEmpty =
                !o.nameOverride && !o.roleOverride && !o.isMerc;
            if (isEmpty) {
                return prisma.rosterParticipantOverride.deleteMany({
                    where: {
                        discordGuildId: resolved.guildId,
                        eventId: body.eventId!,
                        participantKey: o.participantKey,
                    },
                });
            }
            return prisma.rosterParticipantOverride.upsert({
                where: {
                    discordGuildId_eventId_participantKey: {
                        discordGuildId: resolved.guildId,
                        eventId: body.eventId!,
                        participantKey: o.participantKey,
                    },
                },
                update: {
                    nameOverride: o.nameOverride ?? null,
                    roleOverride: o.roleOverride ?? null,
                    isMerc: o.isMerc ?? false,
                },
                create: {
                    discordGuildId: resolved.guildId,
                    eventId: body.eventId!,
                    participantKey: o.participantKey,
                    nameOverride: o.nameOverride ?? null,
                    roleOverride: o.roleOverride ?? null,
                    isMerc: o.isMerc ?? false,
                },
            });
        }),
    );

    return NextResponse.json({ ok: true });
}
