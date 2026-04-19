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

    const match = candidates.find(([, value]) => Boolean(value?.trim()));

    if (!match) {
        throw new Error(
            "No database URL found. Set DATABASE_URL (runtime) and DIRECT_URL (migrations).",
        );
    }

    const [sourceName, sourceValue] = match;

    try {
        const parsed = new URL(sourceValue as string);
        if (parsed.username === "prisma_migration") {
            throw new Error(
                `Runtime DB URL from ${sourceName} uses migration role 'prisma_migration'. Point APP_DATABASE_URL (or your *_SECOND runtime var) to an app/runtime connection string.`,
            );
        }
    } catch (error) {
        if (error instanceof Error && error.message.includes("prisma_migration")) {
            throw error;
        }
        // Ignore URL parsing errors and let Prisma handle malformed URLs.
    }

    return sourceValue as string;
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