import { prisma } from "@/lib/prisma";

type ResolvedRosterSession = {
    id: string;
    discordGuildId: string;
    name: string | null;
    status: string;
    isLocked: boolean;
    lockedByUserId: string | null;
};

async function createDefaultRosterSession(guildId: string, userId: string) {
    const existingCount = await prisma.roster.count({
        where: { discordGuildId: guildId },
    });

    return prisma.roster.create({
        data: {
            discordGuildId: guildId,
            name: `Session ${existingCount + 1}`,
            createdByUserId: userId,
        },
        select: {
            id: true,
            discordGuildId: true,
            name: true,
            status: true,
            isLocked: true,
            lockedByUserId: true,
        },
    });
}

export async function setSelectedRosterSession(params: {
    userId: string;
    guildId: string;
    rosterId: string;
}) {
    await prisma.rosterSelectedSession.upsert({
        where: {
            userId_discordGuildId: {
                userId: params.userId,
                discordGuildId: params.guildId,
            },
        },
        create: {
            userId: params.userId,
            discordGuildId: params.guildId,
            rosterId: params.rosterId,
        },
        update: {
            rosterId: params.rosterId,
            updatedAt: new Date(),
        },
    });
}

export async function resolveRosterSession(params: {
    guildId: string;
    userId: string;
    rosterSessionId?: string | null;
    createIfMissing?: boolean;
}): Promise<ResolvedRosterSession | null> {
    const createIfMissing = params.createIfMissing ?? true;

    if (params.rosterSessionId) {
        const byId = await prisma.roster.findFirst({
            where: {
                id: params.rosterSessionId,
                discordGuildId: params.guildId,
            },
            select: {
                id: true,
                discordGuildId: true,
                name: true,
                status: true,
                isLocked: true,
                lockedByUserId: true,
            },
        });

        if (!byId) {
            return null;
        }

        await setSelectedRosterSession({
            userId: params.userId,
            guildId: params.guildId,
            rosterId: byId.id,
        });

        return byId;
    }

    const selected = await prisma.rosterSelectedSession.findUnique({
        where: {
            userId_discordGuildId: {
                userId: params.userId,
                discordGuildId: params.guildId,
            },
        },
        select: {
            roster: {
                select: {
                    id: true,
                    discordGuildId: true,
                    name: true,
                    status: true,
                    isLocked: true,
                    lockedByUserId: true,
                },
            },
        },
    });

    if (selected?.roster) {
        return selected.roster;
    }

    const latest = await prisma.roster.findFirst({
        where: { discordGuildId: params.guildId },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            discordGuildId: true,
            name: true,
            status: true,
            isLocked: true,
            lockedByUserId: true,
        },
    });

    if (latest) {
        await setSelectedRosterSession({
            userId: params.userId,
            guildId: params.guildId,
            rosterId: latest.id,
        });

        return latest;
    }

    if (!createIfMissing) {
        return null;
    }

    const created = await createDefaultRosterSession(params.guildId, params.userId);

    await setSelectedRosterSession({
        userId: params.userId,
        guildId: params.guildId,
        rosterId: created.id,
    });

    return created;
}

export type { ResolvedRosterSession };
