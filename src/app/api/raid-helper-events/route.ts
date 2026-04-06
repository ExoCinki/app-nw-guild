import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";

type RosterUpsertCreateInput = Parameters<typeof prisma.roster.upsert>[0]["create"];
type ParticipantsCacheInput = RosterUpsertCreateInput["raidHelperParticipantsCache"];
type EventsCacheInput = RosterUpsertCreateInput["raidHelperEventsCache"];

export const dynamic = "force-dynamic";

export type RaidHelperEvent = {
    id: string;
    channelId: string;
    title: string;
    startTime: number;
    endTime: number | null;
    signUps: number;
    leaderId: string;
    leaderName: string | null;
    templateId: string | null;
    description: string | null;
    voiceChannelId: string | null;
    advancedSettings: Record<string, unknown> | null;
    closeTime: number | null;
    lastUpdated: number | null;
    color: string | null;
    iconUrl: string | null;
};

type RaidHelperParticipant = {
    name: string | null;
    userId: string | null;
    specName: string | null;
    className: string | null;
};

function parseRefreshFlag(value: string | null) {
    return value === "1" || value === "true";
}

function readEventsCache(value: unknown): RaidHelperEvent[] | null {
    if (!Array.isArray(value)) {
        return null;
    }

    return value as RaidHelperEvent[];
}

function readParticipantsCache(
    value: unknown,
    eventId: string,
): RaidHelperParticipant[] | null {
    if (!value || typeof value !== "object") {
        return null;
    }

    const dict = value as Record<string, unknown>;
    const eventValue = dict[eventId];

    if (!Array.isArray(eventValue)) {
        return null;
    }

    return eventValue as RaidHelperParticipant[];
}

const ABSENT_KEYWORDS = ["absent", "absence", "absents"];

function hasAbsentKeyword(value: string | null) {
    if (!value) {
        return false;
    }

    const normalized = value.trim().toLowerCase();
    return ABSENT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function isAbsentSignup(signup: Record<string, unknown>) {
    const status = typeof signup.status === "string" ? signup.status.toLowerCase() : null;
    const type = typeof signup.type === "string" ? signup.type.toLowerCase() : null;
    const response = typeof signup.response === "string" ? signup.response.toLowerCase() : null;
    const state = typeof signup.state === "string" ? signup.state.toLowerCase() : null;
    const className = typeof signup.className === "string" ? signup.className.toLowerCase() : null;
    const specName = typeof signup.specName === "string" ? signup.specName.toLowerCase() : null;

    const classData =
        signup.class && typeof signup.class === "object"
            ? (signup.class as Record<string, unknown>)
            : null;
    const specData =
        signup.spec && typeof signup.spec === "object"
            ? (signup.spec as Record<string, unknown>)
            : null;
    const character =
        signup.character && typeof signup.character === "object"
            ? (signup.character as Record<string, unknown>)
            : null;

    const nestedClassName = typeof classData?.name === "string" ? classData.name.toLowerCase() : null;
    const nestedSpecName = typeof specData?.name === "string" ? specData.name.toLowerCase() : null;
    const characterClassName = typeof character?.className === "string" ? character.className.toLowerCase() : null;
    const characterSpecName = typeof character?.specName === "string" ? character.specName.toLowerCase() : null;

    return [
        status,
        type,
        response,
        state,
        className,
        specName,
        nestedClassName,
        nestedSpecName,
        characterClassName,
        characterSpecName,
    ].some(hasAbsentKeyword);
}

function getString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeParticipant(signup: Record<string, unknown>): RaidHelperParticipant {
    const user =
        signup.user && typeof signup.user === "object"
            ? (signup.user as Record<string, unknown>)
            : null;
    const character =
        signup.character && typeof signup.character === "object"
            ? (signup.character as Record<string, unknown>)
            : null;
    const spec =
        signup.spec && typeof signup.spec === "object"
            ? (signup.spec as Record<string, unknown>)
            : null;
    const classData =
        signup.class && typeof signup.class === "object"
            ? (signup.class as Record<string, unknown>)
            : null;

    return {
        name:
            getString(signup.name) ??
            getString(signup.username) ??
            getString(signup.displayName) ??
            getString(signup.nickname) ??
            getString(user?.name) ??
            getString(user?.username) ??
            getString(user?.displayName) ??
            getString(character?.name),
        userId:
            getString(signup.userId) ??
            getString(signup.discordId) ??
            getString(signup.id) ??
            getString(user?.id) ??
            getString(user?.userId) ??
            getString(character?.userId),
        specName:
            getString(signup.specName) ??
            getString(spec?.name) ??
            getString(character?.specName),
        className:
            getString(signup.className) ??
            getString(classData?.name) ??
            getString(character?.className),
    };
}

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const requestedGuildId = url.searchParams.get("guildId");
    const eventId = url.searchParams.get("eventId");
    const forceRefresh = parseRefreshFlag(url.searchParams.get("refresh"));

    // Resolve user + selected guild
    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
    });

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let guildId = requestedGuildId;
    const selectedGuild = await prisma.selectedGuild.findUnique({
        where: { userId: user.id },
        select: { discordGuildId: true },
    });

    if (!guildId) {
        guildId = selectedGuild?.discordGuildId ?? null;
    }

    if (!guildId) {
        return NextResponse.json({ error: "No guild selected" }, { status: 400 });
    }

    const manageableGuilds = await getManagedWhitelistedGuilds(session.user.email);

    let hasAccess = Boolean(
        manageableGuilds?.some((g) => g.id === guildId),
    );

    // Fallback: si le token Discord est indisponible, on autorise la guilde
    // selectionnee si elle est dans la whitelist (couvre events ET participants).
    if (!hasAccess && !manageableGuilds) {
        const isSelectedGuild = selectedGuild?.discordGuildId === guildId;

        if (isSelectedGuild) {
            const whitelisted = await prisma.whitelistedGuild.findUnique({
                where: { discordGuildId: guildId },
                select: { discordGuildId: true },
            });

            hasAccess = Boolean(whitelisted);
        }
    }

    if (!hasAccess) {
        if (!manageableGuilds) {
            return NextResponse.json({ error: "No Discord token found" }, { status: 401 });
        }

        return NextResponse.json(
            { error: "Guild is not manageable for this account" },
            { status: 403 },
        );
    }

    // Load server configuration
    const config = await prisma.guildConfiguration.findUnique({
        where: { discordGuildId: guildId },
        select: { apiKey: true, channelId: true },
    });

    if (!config?.apiKey) {
        return NextResponse.json(
            { error: "No API key configured for this server." },
            { status: 422 },
        );
    }

    if (!config.channelId) {
        return NextResponse.json(
            { error: "No channel ID configured for this server." },
            { status: 422 },
        );
    }

    const rosterCache = await prisma.roster.findUnique({
        where: { discordGuildId: guildId },
        select: {
            raidHelperEventsCache: true,
            raidHelperParticipantsCache: true,
            raidHelperEventsCachedAt: true,
            raidHelperParticipantsCachedAt: true,
        },
    });

    if (eventId) {
        if (!forceRefresh) {
            const cachedParticipants = readParticipantsCache(
                rosterCache?.raidHelperParticipantsCache,
                eventId,
            );

            if (cachedParticipants) {
                return NextResponse.json({
                    participants: cachedParticipants,
                    participantsCachedAt: rosterCache?.raidHelperParticipantsCachedAt,
                });
            }
        }

        const eventRes = await fetch(`https://raid-helper.xyz/api/v4/events/${eventId}`, {
            cache: "no-store",
        });

        if (!eventRes.ok) {
            const body = (await eventRes.text().catch(() => "")).slice(0, 200);
            return NextResponse.json(
                {
                    error: `Unable to load event details (${eventRes.status})${body ? `: ${body}` : ""}.`,
                },
                { status: 502 },
            );
        }

        const eventPayload = (await eventRes.json()) as {
            channelId?: string;
            signUps?: unknown[];
            signups?: unknown[];
        };

        const detailChannelId = getString(eventPayload.channelId);

        if (detailChannelId && detailChannelId !== config.channelId) {
            return NextResponse.json(
                { error: "This event does not match the configured channel." },
                { status: 400 },
            );
        }

        const rawSignups = Array.isArray(eventPayload.signUps)
            ? eventPayload.signUps
            : Array.isArray(eventPayload.signups)
                ? eventPayload.signups
                : [];

        const participants = rawSignups
            .filter(
                (signup): signup is Record<string, unknown> =>
                    !!signup && typeof signup === "object",
            )
            .filter((signup) => !isAbsentSignup(signup))
            .map(normalizeParticipant)
            .filter(
                (participant) =>
                    !hasAbsentKeyword(participant.className) &&
                    !hasAbsentKeyword(participant.specName) &&
                    !hasAbsentKeyword(participant.name),
            )
            .filter(
                (participant) =>
                    participant.name ||
                    participant.userId ||
                    participant.specName ||
                    participant.className,
            );

        const existingParticipantsCache =
            rosterCache?.raidHelperParticipantsCache &&
                typeof rosterCache.raidHelperParticipantsCache === "object"
                ? (rosterCache.raidHelperParticipantsCache as Record<string, unknown>)
                : {};

        const mergedParticipantsCache = {
            ...existingParticipantsCache,
            [eventId]: participants,
        } as unknown as ParticipantsCacheInput;

        const participantsCachedAt = new Date();

        await prisma.roster.upsert({
            where: { discordGuildId: guildId },
            create: {
                discordGuildId: guildId,
                raidHelperParticipantsCache: mergedParticipantsCache,
                raidHelperParticipantsCachedAt: participantsCachedAt,
            },
            update: {
                raidHelperParticipantsCache: mergedParticipantsCache,
                raidHelperParticipantsCachedAt: participantsCachedAt,
            },
        });

        return NextResponse.json({
            participants,
            participantsCachedAt,
        });
    }

    if (!forceRefresh) {
        const cachedEvents = readEventsCache(rosterCache?.raidHelperEventsCache);

        if (cachedEvents) {
            return NextResponse.json({
                events: cachedEvents,
                channelId: config.channelId,
                eventsCachedAt: rosterCache?.raidHelperEventsCachedAt,
            });
        }
    }

    // Call RaidHelper API
    const rhRes = await fetch(
        `https://raid-helper.xyz/api/v4/servers/${guildId}/events`,
        {
            headers: {
                Authorization: config.apiKey,
            },
            cache: "no-store",
        },
    );

    if (!rhRes.ok) {
        const body = (await rhRes.text().catch(() => "")).slice(0, 200);
        return NextResponse.json(
            {
                error: `RaidHelper a répondu ${rhRes.status}${body ? ": " + body : ""}.`,
            },
            { status: 502 },
        );
    }

    const rhData = (await rhRes.json()) as {
        postedEvents?: RaidHelperEvent[];
    };

    const allEvents = rhData.postedEvents ?? [];

    // Filter by configured channel
    const filtered = allEvents.filter(
        (event) => event.channelId === config.channelId,
    );

    // Sort by startTime ascending
    filtered.sort((a, b) => a.startTime - b.startTime);

    const filteredEventsCache = filtered as unknown as EventsCacheInput;

    const eventsCachedAt = new Date();

    await prisma.roster.upsert({
        where: { discordGuildId: guildId },
        create: {
            discordGuildId: guildId,
            raidHelperEventsCache: filteredEventsCache,
            raidHelperEventsCachedAt: eventsCachedAt,
        },
        update: {
            raidHelperEventsCache: filteredEventsCache,
            raidHelperEventsCachedAt: eventsCachedAt,
        },
    });

    return NextResponse.json({
        events: filtered,
        channelId: config.channelId,
        eventsCachedAt,
    });
}
