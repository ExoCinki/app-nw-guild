import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireAuth, requireGuildAuth } from "@/lib/route-guard";

export const dynamic = "force-dynamic";

export const GET = apiHandler("GET /api/guild-config", async (request: NextRequest) => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const guild = await requireGuildAuth(
        auth.email,
        request.nextUrl.searchParams.get("guildId"),
        "configuration",
        "read",
    );
    if ("response" in guild) return guild.response;

    let config = await prisma.guildConfiguration.findUnique({
        where: { discordGuildId: guild.resolved.guildId },
    });

    if (!config) {
        config = await prisma.guildConfiguration.create({
            data: { discordGuildId: guild.resolved.guildId },
        });
    }

    return NextResponse.json(config);
});
