import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SHARE_LINK_TTL_DAYS = 30;

function hashShareToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ token: string }> },
) {
    try {
        const { token } = await params;
        const tokenHash = hashShareToken(token);
        const normalizedTokenHash = hashShareToken(token.toLowerCase());

        const share = await prisma.scoreboardSessionShare.findFirst({
            where: {
                shareTokenHash: {
                    in:
                        tokenHash === normalizedTokenHash
                            ? [tokenHash]
                            : [tokenHash, normalizedTokenHash],
                },
            },
            include: {
                session: {
                    include: {
                        entries: {
                            orderBy: [{ kills: "desc" }, { assists: "desc" }, { playerName: "asc" }],
                        },
                    },
                },
            },
        });

        if (!share) {
            return NextResponse.json(
                {
                    error:
                        "Shared session not found. The link may have been regenerated or is invalid.",
                },
                { status: 404 },
            );
        }

        const expiresAt = new Date(
            share.updatedAt.getTime() + SHARE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000,
        );

        if (expiresAt.getTime() <= Date.now()) {
            return NextResponse.json(
                { error: "This shared link has expired. Ask an admin to generate a new one." },
                { status: 410 },
            );
        }

        const guild = await prisma.whitelistedGuild.findUnique({
            where: { discordGuildId: share.discordGuildId },
            select: { name: true },
        });

        return NextResponse.json({
            session: {
                id: share.session.id,
                name: share.session.name,
                status: share.session.status,
                createdAt: share.session.createdAt,
                shareExpiresAt: expiresAt,
                guildId: share.discordGuildId,
                guildName: guild?.name ?? null,
            },
            entries: share.session.entries,
        });
    } catch (error) {
        console.error("GET /api/scoreboard/shared/[token]", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
