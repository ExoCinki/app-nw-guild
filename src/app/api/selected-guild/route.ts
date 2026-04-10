import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";
import { apiHandler, requireAuth } from "@/lib/route-guard";

export const dynamic = "force-dynamic";

export const GET = apiHandler("GET /api/selected-guild", async () => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const user = await prisma.user.findUnique({
        where: { email: auth.email },
        select: { id: true },
    });

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const selected = await prisma.selectedGuild.findUnique({
        where: { userId: user.id },
        select: {
            discordGuildId: true,
            discordGuildName: true,
            discordGuildIconUrl: true,
        },
    });

    if (!selected?.discordGuildId) {
        const response = NextResponse.json({
            selectedGuildId: null,
            selectedGuild: null,
        });
        // Cache negative responses for 5 minutes
        response.headers.set("Cache-Control", "private, max-age=300");
        return response;
    }

    // Fast path: return cached data immediately (no Discord call needed)
    const fallbackWhitelistedGuild = await prisma.whitelistedGuild.findUnique({
        where: { discordGuildId: selected.discordGuildId },
        select: {
            discordGuildId: true,
            name: true,
        },
    });

    const responseData = {
        selectedGuildId: selected.discordGuildId,
        selectedGuild: {
            id: selected.discordGuildId,
            name:
                selected.discordGuildName ??
                fallbackWhitelistedGuild?.name ??
                null,
            iconUrl: selected.discordGuildIconUrl ?? null,
        },
    };

    const response = NextResponse.json(responseData);
    // Cache the response for 5 minutes
    response.headers.set("Cache-Control", "private, max-age=300");

    // Async update Discord data in background (non-blocking)
    // This ensures the user gets a fast response while data is kept fresh
    getManagedWhitelistedGuilds(auth.email)
        .then((manageableGuildsResult) => {
            if (manageableGuildsResult.ok) {
                const selectedGuild = manageableGuildsResult.guilds.find(
                    (guild) => guild.id === selected.discordGuildId,
                );

                if (selectedGuild) {
                    if (
                        selectedGuild.name !== selected.discordGuildName ||
                        selectedGuild.iconUrl !== selected.discordGuildIconUrl
                    ) {
                        // Fire and forget - don't await
                        prisma.selectedGuild.update({
                            where: { userId: user.id },
                            data: {
                                discordGuildName: selectedGuild.name,
                                discordGuildIconUrl: selectedGuild.iconUrl,
                            },
                        }).catch((err) => {
                            console.warn("Failed to update selected guild data:", err);
                        });
                    }
                }
            }
        })
        .catch((err) => {
            console.warn("Failed to refresh selected guild from Discord:", err);
        });

    return response;
});

export const POST = apiHandler("POST /api/selected-guild", async (request: Request) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const { guildId } = (await request.json()) as { guildId: string };

    if (!guildId) {
        return NextResponse.json(
            { error: "guildId is required" },
            { status: 400 },
        );
    }

    const user = await prisma.user.findUnique({
        where: { email: auth.email },
        select: { id: true },
    });

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const manageableGuildsResult = await getManagedWhitelistedGuilds(auth.email);

    if (!manageableGuildsResult.ok) {
        return NextResponse.json(
            { error: manageableGuildsResult.error },
            { status: manageableGuildsResult.status },
        );
    }

    const manageableGuilds = manageableGuildsResult.guilds;

    const selectedManagedGuild = manageableGuilds.find((guild) => guild.id === guildId);
    const canManageGuild = Boolean(selectedManagedGuild);

    if (!canManageGuild) {
        return NextResponse.json(
            { error: "Guild is not manageable for this account" },
            { status: 403 },
        );
    }

    const selected = await prisma.selectedGuild.upsert({
        where: { userId: user.id },
        update: {
            discordGuildId: guildId,
            discordGuildName: selectedManagedGuild?.name ?? null,
            discordGuildIconUrl: selectedManagedGuild?.iconUrl ?? null,
            updatedAt: new Date(),
        },
        create: {
            userId: user.id,
            discordGuildId: guildId,
            discordGuildName: selectedManagedGuild?.name ?? null,
            discordGuildIconUrl: selectedManagedGuild?.iconUrl ?? null,
        },
    });

    return NextResponse.json({ selectedGuildId: selected.discordGuildId });
});
