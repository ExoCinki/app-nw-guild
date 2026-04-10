/**
 * Helpers pour les routes API Next.js.
 *
 * Objectif : éliminer le boilerplate répété dans ~15 routes :
 *   - vérification de session / 401
 *   - résolution guild + scope / 403
 *   - try/catch + 500
 *
 * Usage :
 *   export const GET = apiHandler("GET /api/my-route", async (req) => {
 *     const auth  = await requireAuth();
 *     if ("response" in auth) return auth.response;
 *
 *     const guild = await requireGuildAuth(auth.email, req.nextUrl.searchParams.get("guildId"), "payout");
 *     if ("response" in guild) return guild.response;
 *
 *     // logique métier...
 *     return NextResponse.json(data);
 *   });
 */

import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { resolveManagedGuildForUser } from "@/lib/managed-guild-access";
import type { GuildAccessMode, GuildAccessScope } from "@/lib/admin-access";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthOk = { email: string };
type AuthFail = { response: NextResponse };

type GuildAuthOk = { resolved: { userId: string; guildId: string } };
type GuildAuthFail = { response: NextResponse };

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Vérifie la session NextAuth. Retourne `{ email }` si authentifié,
 * sinon `{ response }` avec un 401 prêt à être renvoyé.
 */
export async function requireAuth(): Promise<AuthOk | AuthFail> {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
    return { email: session.user.email };
}

/**
 * Résout le guild de l'utilisateur via `resolveManagedGuildForUser`.
 * Retourne `{ resolved }` si OK, sinon `{ response }` avec le code HTTP approprié.
 */
export async function requireGuildAuth(
    email: string,
    guildId: string | null | undefined,
    scope: GuildAccessScope,
    mode: GuildAccessMode = "read",
): Promise<GuildAuthOk | GuildAuthFail> {
    const resolved = await resolveManagedGuildForUser(email, guildId ?? null, scope, mode);
    if ("error" in resolved) {
        return {
            response: NextResponse.json({ error: resolved.error }, { status: resolved.status }),
        };
    }
    return { resolved };
}

/**
 * Wrapper try/catch pour un handler de route.
 * Intercepte toute exception non gérée et renvoie un 500 loggué.
 *
 * Supporte les dynamic segments via les params du route handler de Next.js :
 *   export const GET = apiHandler("GET /api/foo/[id]", async (req, ctx) => { ... });
 */
export function apiHandler<TParams = unknown>(
    label: string,
    fn: (request: NextRequest, params: TParams) => Promise<NextResponse>,
): (request: NextRequest, params: TParams) => Promise<NextResponse> {
    return async (request: NextRequest, params: TParams) => {
        try {
            return await fn(request, params);
        } catch (error) {
            console.error(label, error);
            return NextResponse.json({ error: "Internal server error" }, { status: 500 });
        }
    };
}
