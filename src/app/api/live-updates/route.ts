import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";
import { ensureLiveUpdatesReady, subscribeLiveUpdates } from "@/lib/live-updates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

function toSseFrame(data: unknown) {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function GET() {
    await ensureLiveUpdatesReady();

    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const manageableGuildsResult = await getManagedWhitelistedGuilds(session.user.email);

    if (!manageableGuildsResult.ok) {
        return NextResponse.json(
            { error: manageableGuildsResult.error },
            { status: manageableGuildsResult.status },
        );
    }

    const manageableGuilds = manageableGuildsResult.guilds;

    const manageableGuildIds = new Set(manageableGuilds.map((guild) => guild.id));

    let unsubscribe: (() => void) | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
        if (heartbeat) {
            clearInterval(heartbeat);
            heartbeat = null;
        }

        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
    };

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(toSseFrame({ type: "connected", timestamp: Date.now() }));

            unsubscribe = subscribeLiveUpdates((event) => {
                if (!manageableGuildIds.has(event.guildId)) {
                    return;
                }

                controller.enqueue(toSseFrame({ type: "update", ...event }));
            });

            // Keep the connection alive through intermediaries.
            heartbeat = setInterval(() => {
                controller.enqueue(toSseFrame({ type: "heartbeat", timestamp: Date.now() }));
            }, 25_000);
        },
        cancel() {
            cleanup();
        },
    });

    return new NextResponse(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
