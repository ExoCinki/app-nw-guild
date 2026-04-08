const SLOW_THRESHOLD_MS = 400;

export async function withApiTiming<T>(
    label: string,
    action: () => Promise<T>,
): Promise<T> {
    const startedAt = Date.now();

    try {
        return await action();
    } finally {
        const duration = Date.now() - startedAt;
        if (duration >= SLOW_THRESHOLD_MS) {
            console.info(`[api][slow] ${label} took ${duration}ms`);
        }
    }
}
