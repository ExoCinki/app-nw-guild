import { parsePositiveInt } from "./utils";
import type { PlayerSortKey, SessionSortKey, SortDir, ViewMode } from "./types";

// ─── State ───────────────────────────────────────────────────────────────────

export type ScoreboardState = {
    viewMode: ViewMode;
    selectedSessionId: string | null;
    selectedGuildId: string;
    sessionSearch: string;
    playerSearch: string;
    focusedPlayerKey: string;
    sessionSortKey: SessionSortKey;
    sessionSortDir: SortDir;
    playerSortKey: PlayerSortKey;
    playerSortDir: SortDir;
    sessionPage: number;
    playerPage: number;
};

// ─── Actions ─────────────────────────────────────────────────────────────────

export type ScoreboardAction =
    | { type: "SET_VIEW"; view: ViewMode }
    | { type: "SELECT_SESSION"; id: string | null }
    | { type: "SET_GUILD"; id: string }
    | { type: "SET_SESSION_SEARCH"; q: string }
    | { type: "SET_PLAYER_SEARCH"; q: string }
    | { type: "FOCUS_PLAYER"; key: string }
    | { type: "OPEN_PLAYER_PROFILE"; key: string }
    | { type: "TOGGLE_SESSION_SORT"; key: SessionSortKey }
    | { type: "TOGGLE_PLAYER_SORT"; key: PlayerSortKey }
    | { type: "SET_SESSION_PAGE"; page: number }
    | { type: "SET_PLAYER_PAGE"; page: number };

// ─── Reducer ─────────────────────────────────────────────────────────────────

export function scoreboardReducer(
    state: ScoreboardState,
    action: ScoreboardAction,
): ScoreboardState {
    switch (action.type) {
        case "SET_VIEW":
            return { ...state, viewMode: action.view };

        case "SELECT_SESSION":
            return { ...state, selectedSessionId: action.id, sessionPage: 1 };

        case "SET_GUILD":
            return {
                ...state,
                selectedGuildId: action.id,
                selectedSessionId: null,
                focusedPlayerKey: "",
                sessionPage: 1,
                playerPage: 1,
            };

        case "SET_SESSION_SEARCH":
            return { ...state, sessionSearch: action.q, sessionPage: 1 };

        case "SET_PLAYER_SEARCH":
            return { ...state, playerSearch: action.q, playerPage: 1 };

        case "FOCUS_PLAYER":
            return { ...state, focusedPlayerKey: action.key };

        case "OPEN_PLAYER_PROFILE":
            return { ...state, viewMode: "players", focusedPlayerKey: action.key };

        case "TOGGLE_SESSION_SORT":
            if (state.sessionSortKey === action.key) {
                return {
                    ...state,
                    sessionSortDir: state.sessionSortDir === "asc" ? "desc" : "asc",
                    sessionPage: 1,
                };
            }
            return {
                ...state,
                sessionSortKey: action.key,
                sessionSortDir: action.key === "playerName" ? "asc" : "desc",
                sessionPage: 1,
            };

        case "TOGGLE_PLAYER_SORT":
            if (state.playerSortKey === action.key) {
                return {
                    ...state,
                    playerSortDir: state.playerSortDir === "asc" ? "desc" : "asc",
                    playerPage: 1,
                };
            }
            return {
                ...state,
                playerSortKey: action.key,
                playerSortDir: action.key === "playerName" ? "asc" : "desc",
                playerPage: 1,
            };

        case "SET_SESSION_PAGE":
            return { ...state, sessionPage: action.page };

        case "SET_PLAYER_PAGE":
            return { ...state, playerPage: action.page };
    }
}

// ─── URL helpers ──────────────────────────────────────────────────────────────

/** Initialise l'état depuis les paramètres d'URL (lazy initializer de useReducer). */
export function initStateFromParams(
    params: { get(name: string): string | null },
): ScoreboardState {
    return {
        viewMode: params.get("view") === "players" ? "players" : "sessions",
        selectedSessionId: params.get("session"),
        selectedGuildId: params.get("guild") ?? "all",
        sessionSearch: params.get("sq") ?? "",
        playerSearch: params.get("pq") ?? "",
        focusedPlayerKey: params.get("player") ?? "",
        sessionSortKey: (params.get("ssk") as SessionSortKey | null) ?? "kills",
        sessionSortDir: params.get("ssd") === "asc" ? "asc" : "desc",
        playerSortKey: (params.get("psk") as PlayerSortKey | null) ?? "kda",
        playerSortDir: params.get("psd") === "asc" ? "asc" : "desc",
        sessionPage: parsePositiveInt(params.get("sp"), 1),
        playerPage: parsePositiveInt(params.get("pp"), 1),
    };
}

/** Sérialise l'état courant en URLSearchParams (pour le lien partageable et le sync URL). */
export function stateToParams(
    state: ScoreboardState,
    effectiveSessionId: string | null,
    effectiveSessionPage: number,
    effectivePlayerPage: number,
): URLSearchParams {
    const params = new URLSearchParams();

    params.set("view", state.viewMode);
    if (state.selectedGuildId !== "all") params.set("guild", state.selectedGuildId);
    if (effectiveSessionId) params.set("session", effectiveSessionId);
    if (state.sessionSearch.trim()) params.set("sq", state.sessionSearch.trim());
    if (state.playerSearch.trim()) params.set("pq", state.playerSearch.trim());
    if (state.focusedPlayerKey) params.set("player", state.focusedPlayerKey);
    params.set("ssk", state.sessionSortKey);
    params.set("ssd", state.sessionSortDir);
    params.set("sp", String(effectiveSessionPage));
    params.set("psk", state.playerSortKey);
    params.set("psd", state.playerSortDir);
    params.set("pp", String(effectivePlayerPage));

    return params;
}
