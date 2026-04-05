import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getOwnerSessionStatus() {
    const session = await getServerSession(authOptions);
    const ownerDiscordId = process.env.OWNER_DISCORD_ID;

    if (!session?.user?.id || !session.user.discordId) {
        return { status: "unauthorized" as const, session, ownerDiscordId };
    }

    if (!ownerDiscordId) {
        return { status: "misconfigured" as const, session, ownerDiscordId };
    }

    if (session.user.discordId !== ownerDiscordId) {
        return { status: "forbidden" as const, session, ownerDiscordId };
    }

    return { status: "ok" as const, session, ownerDiscordId };
}