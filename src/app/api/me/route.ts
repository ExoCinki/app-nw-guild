import { NextResponse } from "next/server";
import { getCurrentUserAccessState } from "@/lib/current-user-access";

export const dynamic = "force-dynamic";

export async function GET() {
    const accessState = await getCurrentUserAccessState();

    if (accessState.status === "unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (accessState.status !== "ok") {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
        user: accessState.user,
        selectedGuildId: accessState.selectedGuildId,
        hasSelectedGuildAccess: accessState.hasSelectedGuildAccess,
        access: accessState.access,
    });
}