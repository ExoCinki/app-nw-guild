import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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

        let config = await prisma.guildConfiguration.findUnique({
            where: { discordGuildId: guildId },
        });

        if (!config) {
            config = await prisma.guildConfiguration.create({
                data: {
                    discordGuildId: guildId,
                },
            });
        }

        return NextResponse.json(config);
    } catch (error) {
        console.error("GET /api/guild-config", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
