import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getManagedWhitelistedGuilds } from "@/lib/managed-guilds";
import { ensureLiveUpdatesReady, subscribeLiveUpdates } from "@/lib/live-updates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const SSE_SOFT_CLOSE_MS = 270_000;

const encoder = new TextEncoder();

function toSseFrame(data: unknown) {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: Request) {
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
    let softCloseTimer: ReturnType<typeof setTimeout> | null = null;
    let isClosed = false;
    let streamController: ReadableStreamDefaultController<Uint8Array> | null =
        null;

    const cleanup = () => {
        if (isClosed) {
            return;
        }
        isClosed = true;

        if (heartbeat) {
            clearInterval(heartbeat);
            heartbeat = null;
        }

        if (softCloseTimer) {
            clearTimeout(softCloseTimer);
            softCloseTimer = null;
        }

        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }

        try {
            streamController?.close();
        } catch {
            // Ignore double-close errors.
        }

        streamController = null;
    };

    request.signal.addEventListener("abort", cleanup);

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            streamController = controller;
            controller.enqueue(
                toSseFrame({ type: "connected", timestamp: Date.now() }),
            );

            unsubscribe = subscribeLiveUpdates((event) => {
                if (!manageableGuildIds.has(event.guildId)) {
                    return;
                }

                try {
                    controller.enqueue(toSseFrame({ type: "update", ...event }));
                } catch {
                    cleanup();
                }
            });

            // Keep the connection alive through intermediaries.
            heartbeat = setInterval(() => {
                try {
                    controller.enqueue(
                        toSseFrame({ type: "heartbeat", timestamp: Date.now() }),
                    );
                } catch {
                    cleanup();
                }
            }, 25_000);

            // Close before Vercel hard timeout; EventSource reconnects automatically.
            softCloseTimer = setTimeout(() => {
                cleanup();
            }, SSE_SOFT_CLOSE_MS);
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
