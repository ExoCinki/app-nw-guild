import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ token: string }> };

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: RouteParams) {
    const { token } = await params;
    const shareTokenHash = createHash("sha256").update(token).digest("hex");

    const share = await prisma.rosterSessionShare.findUnique({
        where: { shareTokenHash },
        select: {
            session: {
                select: {
                    id: true,
                    name: true,
                    status: true,
                    selectedEventId: true,
                    raidHelperEventsCache: true,
                    groups: {
                        orderBy: [{ rosterIndex: "asc" }, { groupNumber: "asc" }],
                        include: { slots: { orderBy: { position: "asc" } } },
                    },
                    createdAt: true,
                    updatedAt: true,
                },
            },
            updatedAt: true,
        },
    });

    if (!share?.session) {
        return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    return NextResponse.json({
        roster: share.session,
        sharedAt: share.updatedAt,
    });
}
