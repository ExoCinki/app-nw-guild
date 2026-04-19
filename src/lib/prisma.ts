import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

function resolveRuntimeDatabaseUrl() {
    const candidates: Array<[string, string | undefined]> = [
        // Manual override when integration-provided vars are locked.
        ["APP_DATABASE_URL", process.env.APP_DATABASE_URL],
        // Preferred explicit app runtime URL.
        ["DATABASE_URL", process.env.DATABASE_URL],
        // Prisma Console / integrations can expose this for runtime.
        ["PRISMA_DATABASE_URL", process.env.PRISMA_DATABASE_URL_SECOND],
        // Vercel Postgres compatibility fallback.
        ["POSTGRES_PRISMA_URL", process.env.POSTGRES_PRISMA_URL_SECONDARY],
        ["POSTGRES_URL", process.env.POSTGRES_URL_SECONDARY],
    ];

    const match = candidates.find(([, value]) => Boolean(value?.trim()));

    if (!match) {
        throw new Error(
            "No database URL found. Set DATABASE_URL (runtime) and DIRECT_URL (migrations).",
        );
    }

    return match[1] as string;
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