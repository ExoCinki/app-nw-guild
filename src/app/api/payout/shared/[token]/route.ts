import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const SHARE_LINK_TTL_DAYS = 30;

function hashShareToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

function resolveMultiplier(value: number | null | undefined): number {
    return value || 1;
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ token: string }> },
) {
    try {
        const { token } = await params;
        const tokenHash = hashShareToken(token);
        const normalizedTokenHash = hashShareToken(token.toLowerCase());

        const share = await prisma.payoutSessionShare.findFirst({
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
                            orderBy: [{ displayName: "asc" }, { username: "asc" }],
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

        const guildConfiguration = await prisma.guildConfiguration.findUnique({
            where: { discordGuildId: share.discordGuildId },
            select: {
                zooMemberRoleId: true,
                zooMemberRoleName: true,
                warsCount: true,
                racesCount: true,
                reviewsCount: true,
                bonusCount: true,
                invasionsCount: true,
                vodsCount: true,
            },
        });

        const multipliers = {
            wars: resolveMultiplier(guildConfiguration?.warsCount),
            races: resolveMultiplier(guildConfiguration?.racesCount),
            reviews: resolveMultiplier(guildConfiguration?.reviewsCount),
            bonus: resolveMultiplier(guildConfiguration?.bonusCount),
            invasions: resolveMultiplier(guildConfiguration?.invasionsCount),
            vods: resolveMultiplier(guildConfiguration?.vodsCount),
        };

        const entries = share.session.entries.map((entry) => {
            const points =
                entry.wars * multipliers.wars +
                entry.races * multipliers.races +
                entry.reviews * multipliers.reviews +
                entry.bonus * multipliers.bonus +
                entry.invasions * multipliers.invasions +
                entry.vods * multipliers.vods;

            return {
                id: entry.id,
                username: entry.username,
                displayName: entry.displayName,
                wars: entry.wars,
                races: entry.races,
                reviews: entry.reviews,
                bonus: entry.bonus,
                invasions: entry.invasions,
                vods: entry.vods,
                isPaid: entry.isPaid,
                points,
            };
        });

        const totalPoints = entries.reduce((sum, entry) => sum + entry.points, 0);
        const goldPerPoint = totalPoints > 0 ? share.session.goldPool / totalPoints : 0;

        return NextResponse.json({
            session: {
                id: share.session.id,
                name: share.session.name,
                createdAt: share.session.createdAt,
                shareExpiresAt: expiresAt,
                totalConfiguredBalance: share.session.goldPool,
                totalPoints,
                goldPerPoint,
            },
            accessRole: {
                id: guildConfiguration?.zooMemberRoleId ?? null,
                name: guildConfiguration?.zooMemberRoleName ?? null,
            },
            entries: entries.map((entry) => ({
                ...entry,
                goldEarned: entry.points * goldPerPoint,
            })),
        });
    } catch (error) {
        console.error("GET /api/payout/shared/[token]", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
