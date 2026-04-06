import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";

export const dynamic = "force-dynamic";

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
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
        return NextResponse.json({
            selectedGuildId: null,
            selectedGuild: null,
        });
    }

    const fallbackWhitelistedGuild = await prisma.whitelistedGuild.findUnique({
        where: { discordGuildId: selected.discordGuildId },
        select: {
            discordGuildId: true,
            name: true,
        },
    });

    try {
        const manageableGuildsResult = await getManagedWhitelistedGuilds(session.user.email);

        if (manageableGuildsResult.ok) {
            const selectedGuild = manageableGuildsResult.guilds.find(
                (guild) => guild.id === selected.discordGuildId,
            );

            if (selectedGuild) {
                if (
                    selectedGuild.name !== selected.discordGuildName ||
                    selectedGuild.iconUrl !== selected.discordGuildIconUrl
                ) {
                    await prisma.selectedGuild.update({
                        where: { userId: user.id },
                        data: {
                            discordGuildName: selectedGuild.name,
                            discordGuildIconUrl: selectedGuild.iconUrl,
                        },
                    });
                }

                return NextResponse.json({
                    selectedGuildId: selectedGuild.id,
                    selectedGuild: {
                        id: selectedGuild.id,
                        name: selectedGuild.name,
                        iconUrl: selectedGuild.iconUrl,
                    },
                });
            }
        }
    } catch {
        // Discord can intermittently fail; keep navbar stable by using persisted selection fallback.
        console.warn("selected-guild GET fallback used (Discord unavailable)");
    }

    return NextResponse.json({
        selectedGuildId: selected.discordGuildId,
        selectedGuild: {
            id: selected.discordGuildId,
            name:
                selected.discordGuildName ??
                fallbackWhitelistedGuild?.name ??
                null,
            iconUrl: selected.discordGuildIconUrl ?? null,
        },
    });
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = (await request.json()) as { guildId: string };

    if (!guildId) {
        return NextResponse.json(
            { error: "guildId is required" },
            { status: 400 },
        );
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
    });

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const manageableGuildsResult = await getManagedWhitelistedGuilds(session.user.email);

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
}
