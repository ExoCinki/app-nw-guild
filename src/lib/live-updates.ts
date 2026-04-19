type LiveUpdateTopic = "roster" | "payout" | "scoreboard";

type LiveUpdateEvent = {
    id: number;
    topic: LiveUpdateTopic;
    guildId: string;
    timestamp: number;
};

type LiveUpdateListener = (event: LiveUpdateEvent) => void;

type RedisLikeClient = {
    publish(channel: string, message: string): Promise<number>;
    subscribe(channel: string): Promise<number>;
    on(event: "message", listener: (channel: string, message: string) => void): void;
    disconnect(): void;
};

type LiveUpdateStore = {
    sequence: number;
    listeners: Set<LiveUpdateListener>;
    instanceId: string;
    redisPublisher: RedisLikeClient | null;
    redisSubscriber: RedisLikeClient | null;
    redisInitPromise: Promise<void> | null;
};

type LiveUpdateEnvelope = LiveUpdateEvent & {
    sourceInstanceId: string;
};

const LIVE_UPDATES_CHANNEL = "app-nw-guild:live-updates";

declare global {
    var __liveUpdateStore: LiveUpdateStore | undefined;
}

function getStore(): LiveUpdateStore {
    if (!globalThis.__liveUpdateStore) {
        globalThis.__liveUpdateStore = {
            sequence: 0,
            listeners: new Set<LiveUpdateListener>(),
            instanceId: crypto.randomUUID(),
            redisPublisher: null,
            redisSubscriber: null,
            redisInitPromise: null,
        };
    }

    return globalThis.__liveUpdateStore;
}

function getRedisUrl() {
    const preferred = process.env.REDIS_URL?.trim();
    if (preferred) {
        return preferred;
    }

    const upstash = process.env.UPSTASH_REDIS_URL?.trim();
    if (upstash) {
        return upstash;
    }

    return null;
}

function emitLocally(event: LiveUpdateEvent) {
    const store = getStore();
    for (const listener of store.listeners) {
        listener(event);
    }
}

function toLiveUpdateEvent(envelope: LiveUpdateEnvelope): LiveUpdateEvent {
    return {
        id: envelope.id,
        topic: envelope.topic,
        guildId: envelope.guildId,
        timestamp: envelope.timestamp,
    };
}

async function createRedisClient(url: string): Promise<RedisLikeClient> {
    const redisModule = await import("ioredis");
    const RedisCtor = redisModule.default;

    const parsed = new URL(url);

    const dbFromPath = parsed.pathname.replace(/^\//, "").trim();
    const db = dbFromPath ? Number.parseInt(dbFromPath, 10) : undefined;

    return new RedisCtor({
        host: parsed.hostname,
        port: parsed.port ? Number.parseInt(parsed.port, 10) : 6379,
        username: parsed.username || undefined,
        password: parsed.password || undefined,
        db: Number.isNaN(db ?? Number.NaN) ? undefined : db,
        tls: parsed.protocol === "rediss:" ? {} : undefined,
        maxRetriesPerRequest: null,
        enableOfflineQueue: true,
    }) as unknown as RedisLikeClient;
}

export async function ensureLiveUpdatesReady() {
    const store = getStore();
    const redisUrl = getRedisUrl();

    if (!redisUrl) {
        return;
    }

    if (store.redisPublisher && store.redisSubscriber) {
        return;
    }

    if (store.redisInitPromise) {
        await store.redisInitPromise;
        return;
    }

    store.redisInitPromise = (async () => {
        try {
            const publisher = await createRedisClient(redisUrl);
            const subscriber = await createRedisClient(redisUrl);

            subscriber.on("message", (channel, message) => {
                if (channel !== LIVE_UPDATES_CHANNEL) {
                    return;
                }

                try {
                    const envelope = JSON.parse(message) as Partial<LiveUpdateEnvelope>;

                    if (
                        typeof envelope.id !== "number" ||
                        (envelope.topic !== "roster" &&
                            envelope.topic !== "payout" &&
                            envelope.topic !== "scoreboard") ||
                        typeof envelope.guildId !== "string" ||
                        typeof envelope.timestamp !== "number"
                    ) {
                        return;
                    }

                    emitLocally(
                        toLiveUpdateEvent({
                            id: envelope.id,
                            topic: envelope.topic,
                            guildId: envelope.guildId,
                            timestamp: envelope.timestamp,
                            sourceInstanceId:
                                typeof envelope.sourceInstanceId === "string"
                                    ? envelope.sourceInstanceId
                                    : "unknown",
                        }),
                    );
                } catch {
                    // Ignore malformed pub/sub payloads.
                }
            });

            await subscriber.subscribe(LIVE_UPDATES_CHANNEL);

            store.redisPublisher = publisher;
            store.redisSubscriber = subscriber;
        } catch {
            store.redisPublisher?.disconnect();
            store.redisSubscriber?.disconnect();
            store.redisPublisher = null;
            store.redisSubscriber = null;
        }
    })();

    await store.redisInitPromise;
    store.redisInitPromise = null;
}

export function subscribeLiveUpdates(listener: LiveUpdateListener) {
    const store = getStore();
    store.listeners.add(listener);

    return () => {
        store.listeners.delete(listener);
    };
}

async function publishLiveUpdateAsync(input: {
    topic: LiveUpdateTopic;
    guildId: string;
}) {
    const store = getStore();
    store.sequence += 1;

    const event: LiveUpdateEvent = {
        id: store.sequence,
        topic: input.topic,
        guildId: input.guildId,
        timestamp: Date.now(),
    };

    await ensureLiveUpdatesReady();

    if (store.redisPublisher) {
        const payload: LiveUpdateEnvelope = {
            ...event,
            sourceInstanceId: store.instanceId,
        };

        try {
            await store.redisPublisher.publish(
                LIVE_UPDATES_CHANNEL,
                JSON.stringify(payload),
            );
            return;
        } catch {
            store.redisPublisher.disconnect();
            store.redisSubscriber?.disconnect();
            store.redisPublisher = null;
            store.redisSubscriber = null;
        }
    }

    emitLocally(event);
}

export function publishLiveUpdate(input: {
    topic: LiveUpdateTopic;
    guildId: string;
}) {
    void publishLiveUpdateAsync(input);
}

export type { LiveUpdateEvent, LiveUpdateTopic };
