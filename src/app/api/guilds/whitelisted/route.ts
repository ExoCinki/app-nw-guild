import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";

export const dynamic = "force-dynamic";

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await getManagedWhitelistedGuilds(session.user.email);

        if (!result) {
            return NextResponse.json(
                { error: "No Discord token found" },
                { status: 401 },
            );
        }

        return NextResponse.json({
            guilds: result,
        });
    } catch (error) {
        console.error("Error fetching whitelisted guilds:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
