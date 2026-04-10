import { prisma } from "@/lib/prisma";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";
import { NextResponse } from "next/server";
import { apiHandler, requireAuth } from "@/lib/route-guard";

export const dynamic = "force-dynamic";

export const GET = apiHandler("GET /api/guild-config", async () => {
    const auth = await requireAuth();
    if ("response" in auth) return auth.response;

    const guildsResult = await getManagedWhitelistedGuilds(auth.email);
    if (!guildsResult.ok) {
        return NextResponse.json({ error: guildsResult.error }, { status: guildsResult.status });
    }

    if (guildsResult.guilds.length === 0) {
        return NextResponse.json({ error: "No managed guilds" }, { status: 403 });
    }

    const guildId = guildsResult.guilds[0].id;

    let config = await prisma.guildConfiguration.findUnique({ where: { discordGuildId: guildId } });

    if (!config) {
        config = await prisma.guildConfiguration.create({ data: { discordGuildId: guildId } });
    }

    return NextResponse.json(config);
});
