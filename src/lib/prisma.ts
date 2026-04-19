import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

function resolveRuntimeDatabaseUrl() {
    const candidates: Array<[string, string | undefined]> = [
        // Manual override when integration-provided vars are locked.
        ["APP_DATABASE_URL", process.env.APP_DATABASE_URL],
        // Custom env names used in this deployment.
        ["DATABASE_URL_SECOND", process.env.DATABASE_URL_SECOND],
        ["PRISMA_DATABASE_URL_SECOND", process.env.PRISMA_DATABASE_URL_SECOND],
        ["POSTGRES_PRISMA_URL_SECONDARY", process.env.POSTGRES_PRISMA_URL_SECONDARY],
        ["POSTGRES_URL_SECONDARY", process.env.POSTGRES_URL_SECONDARY],
        // Preferred explicit app runtime URL.
        ["DATABASE_URL", process.env.DATABASE_URL],
        // Prisma Console / integrations can expose this for runtime.
        ["PRISMA_DATABASE_URL", process.env.PRISMA_DATABASE_URL],
        // Vercel Postgres compatibility fallback.
        ["POSTGRES_PRISMA_URL", process.env.POSTGRES_PRISMA_URL],
        ["POSTGRES_URL", process.env.POSTGRES_URL],
    ];

    const availableCandidates = candidates.filter(([, value]) => Boolean(value?.trim()));

    if (availableCandidates.length === 0) {
        throw new Error(
            "No database URL found. Set DATABASE_URL (runtime) and DIRECT_URL (migrations).",
        );
    }

    for (const [, sourceValue] of availableCandidates) {
        try {
            const parsed = new URL(sourceValue as string);

            if (parsed.username === "prisma_migration") {
                continue;
            }

            // Keep runtime serverless traffic conservative to avoid exhausting
            // role-level connection caps when the provider uses transaction pooling.
            if (!parsed.searchParams.has("connection_limit")) {
                parsed.searchParams.set("connection_limit", "1");
            }
            if (!parsed.searchParams.has("pool_timeout")) {
                parsed.searchParams.set("pool_timeout", "20");
            }

            return parsed.toString();
        } catch {
            // Ignore parsing errors here; Prisma will throw on invalid URL if selected.
            if (sourceValue) {
                return sourceValue;
            }
        }
    }

    const configuredSources = availableCandidates.map(([name]) => name).join(", ");
    throw new Error(
        `All configured runtime database URLs (${configuredSources}) use migration role 'prisma_migration'. Set APP_DATABASE_URL to an app/runtime URL.`,
    );
}

const runtimeDatabaseUrl = resolveRuntimeDatabaseUrl();

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        datasourceUrl: runtimeDatabaseUrl,
        log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}