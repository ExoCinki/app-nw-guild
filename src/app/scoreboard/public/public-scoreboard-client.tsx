"use client";

import { useEffect, useMemo, useReducer } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoadingIndicator } from "@/components/loading-indicator";
import { queryPresets } from "@/lib/query-presets";
import type { PublicScoreboardResponse } from "./types";
import {
  buildPlayerAggregates,
  normalizePlayerNameKey,
  safeRatio,
} from "./utils";
import {
  initStateFromParams,
  scoreboardReducer,
  stateToParams,
} from "./scoreboard-reducer";
import { SessionView } from "./session-view";
import { PlayerView } from "./player-view";

const SESSION_PAGE_SIZE = 20;
const PLAYER_PAGE_SIZE = 20;

export default function PublicScoreboardClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Un seul useReducer remplace les 11 useState précédents.
  // La fonction initStateFromParams est le lazy initializer : appelée une seule fois.
  const [state, dispatch] = useReducer(
    scoreboardReducer,
    searchParams,
    initStateFromParams,
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["scoreboard-public"],
    queryFn: async () => {
      const res = await fetch("/api/scoreboard/public");
      if (!res.ok) throw new Error("Unable to load public scoreboards");
      return res.json() as Promise<PublicScoreboardResponse>;
    },
    ...queryPresets.shortLived,
  });

  // ─── Données dérivées ────────────────────────────────────────────────────────

  const sessions = useMemo(() => data?.sessions ?? [], [data?.sessions]);

  const guildOptions = useMemo(() => {
    const byGuild = new Map<string, string>();
    for (const session of sessions) {
      if (!byGuild.has(session.discordGuildId)) {
        byGuild.set(
          session.discordGuildId,
          session.guildName || session.discordGuildId,
        );
      }
    }
    return Array.from(byGuild.entries()).map(([id, label]) => ({ id, label }));
  }, [sessions]);

  const sessionsByGuild = useMemo(
    () =>
      state.selectedGuildId === "all"
        ? sessions
        : sessions.filter((s) => s.discordGuildId === state.selectedGuildId),
    [state.selectedGuildId, sessions],
  );

  const playersByGuild = useMemo(
    () => buildPlayerAggregates(sessionsByGuild),
    [sessionsByGuild],
  );

  const effectiveSessionId = useMemo(() => {
    if (
      state.selectedSessionId &&
      sessionsByGuild.some((s) => s.id === state.selectedSessionId)
    ) {
      return state.selectedSessionId;
    }
    return sessionsByGuild[0]?.id ?? null;
  }, [state.selectedSessionId, sessionsByGuild]);

  const selectedSession = useMemo(
    () => sessionsByGuild.find((s) => s.id === effectiveSessionId) ?? null,
    [effectiveSessionId, sessionsByGuild],
  );

  // ─── Tri / filtre / pagination sessions ───────────────────────────────────

  const sortedFilteredEntries = useMemo(() => {
    const entries = selectedSession?.entries ?? [];
    const needle = state.sessionSearch.trim().toLowerCase();
    const filtered = needle
      ? entries.filter((e) => e.playerName.toLowerCase().includes(needle))
      : entries;

    return [...filtered].sort((a, b) => {
      const dir = state.sessionSortDir === "asc" ? 1 : -1;
      if (state.sessionSortKey === "playerName") {
        return dir * a.playerName.localeCompare(b.playerName);
      }
      return dir * (a[state.sessionSortKey] - b[state.sessionSortKey]);
    });
  }, [
    selectedSession?.entries,
    state.sessionSearch,
    state.sessionSortDir,
    state.sessionSortKey,
  ]);

  const sessionTotalPages = Math.max(
    1,
    Math.ceil(sortedFilteredEntries.length / SESSION_PAGE_SIZE),
  );
  const effectiveSessionPage = Math.min(state.sessionPage, sessionTotalPages);

  const paginatedEntries = useMemo(() => {
    const start = (effectiveSessionPage - 1) * SESSION_PAGE_SIZE;
    return sortedFilteredEntries.slice(start, start + SESSION_PAGE_SIZE);
  }, [effectiveSessionPage, sortedFilteredEntries]);

  // ─── Tri / filtre / pagination joueurs ───────────────────────────────────

  const sortedFilteredPlayers = useMemo(() => {
    const needle = state.playerSearch.trim().toLowerCase();
    const filtered = needle
      ? playersByGuild.filter((p) =>
          p.playerName.toLowerCase().includes(needle),
        )
      : playersByGuild;

    return [...filtered].sort((a, b) => {
      const dir = state.playerSortDir === "asc" ? 1 : -1;
      if (state.playerSortKey === "playerName")
        return dir * a.playerName.localeCompare(b.playerName);
      if (state.playerSortKey === "updatedAt") {
        return (
          dir *
          (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
        );
      }
      if (state.playerSortKey === "kda") {
        return (
          dir *
          (safeRatio(a.kills + a.assists, a.deaths) -
            safeRatio(b.kills + b.assists, b.deaths))
        );
      }
      if (state.playerSortKey === "kd") {
        return (
          dir * (safeRatio(a.kills, a.deaths) - safeRatio(b.kills, b.deaths))
        );
      }
      return dir * (a[state.playerSortKey] - b[state.playerSortKey]);
    });
  }, [
    state.playerSearch,
    state.playerSortDir,
    state.playerSortKey,
    playersByGuild,
  ]);

  const playerTotalPages = Math.max(
    1,
    Math.ceil(sortedFilteredPlayers.length / PLAYER_PAGE_SIZE),
  );
  const effectivePlayerPage = Math.min(state.playerPage, playerTotalPages);

  const paginatedPlayers = useMemo(() => {
    const start = (effectivePlayerPage - 1) * PLAYER_PAGE_SIZE;
    return sortedFilteredPlayers.slice(start, start + PLAYER_PAGE_SIZE);
  }, [effectivePlayerPage, sortedFilteredPlayers]);

  // ─── Fiche joueur focalisé ────────────────────────────────────────────────

  const focusedPlayer = useMemo(
    () => playersByGuild.find((p) => p.key === state.focusedPlayerKey) ?? null,
    [state.focusedPlayerKey, playersByGuild],
  );

  const focusedPlayerSessions = useMemo(() => {
    if (!focusedPlayer) return [];
    return sessionsByGuild
      .map((session) => {
        const entry = session.entries.find(
          (item) =>
            normalizePlayerNameKey(item.playerName) === focusedPlayer.key,
        );
        if (!entry) return null;
        return {
          sessionId: session.id,
          sessionName: session.name || "Scoreboard sans nom",
          guildName: session.guildName || session.discordGuildId,
          status: session.status,
          createdAt: session.createdAt,
          kills: entry.kills,
          deaths: entry.deaths,
          assists: entry.assists,
          damageDealt: entry.damageDealt,
          healingDone: entry.healingDone,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [focusedPlayer, sessionsByGuild]);

  // ─── Sync URL ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const params = stateToParams(
      state,
      effectiveSessionId,
      effectiveSessionPage,
      effectivePlayerPage,
    );
    const nextUrl = `${pathname}${params.toString() ? `?${params}` : ""}`;
    const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`;
    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [
    state,
    effectiveSessionId,
    effectiveSessionPage,
    effectivePlayerPage,
    pathname,
    router,
    searchParams,
  ]);

  async function copyShareLink() {
    const params = stateToParams(
      state,
      effectiveSessionId,
      effectiveSessionPage,
      effectivePlayerPage,
    );
    const url = `${window.location.origin}${pathname}${params.toString() ? `?${params}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Unable to copy link");
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh_-_64px)] items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-8">
        <LoadingIndicator />
      </div>
    );
  }

  if (isError) {
    return (
      <main className="min-h-[calc(100vh_-_64px)] w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-8">
        <div className="mx-auto max-w-5xl rounded-xl border border-red-700/60 bg-red-900/20 p-4 text-sm text-red-200">
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh_-_64px)] w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* En-tête */}
        <header className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/30 backdrop-blur">
          <h1 className="text-2xl font-semibold text-slate-100">
            Public Scoreboard
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Browse scoreboards and global player stats.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Public read-only mode: no edits or deletions possible here.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select
              value={state.selectedGuildId}
              onChange={(e) =>
                dispatch({ type: "SET_GUILD", id: e.target.value })
              }
              className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
            >
              <option value="all">All servers</option>
              {guildOptions.map((guild) => (
                <option key={guild.id} value={guild.id}>
                  {guild.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                void copyShareLink();
              }}
              className="rounded-lg border border-indigo-600/40 bg-indigo-500/20 px-3 py-2 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/30"
            >
              Copy share link
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_VIEW", view: "sessions" })}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                state.viewMode === "sessions"
                  ? "bg-sky-500/20 text-sky-300"
                  : "border border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600"
              }`}
            >
              Sessions
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_VIEW", view: "players" })}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                state.viewMode === "players"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "border border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600"
              }`}
            >
              Player stats
            </button>
          </div>
        </header>

        {/* Contenu principal */}
        {state.viewMode === "sessions" ? (
          <SessionView
            sessions={sessionsByGuild}
            effectiveSessionId={effectiveSessionId}
            selectedSession={selectedSession}
            sortedFilteredEntries={sortedFilteredEntries}
            paginatedEntries={paginatedEntries}
            sessionSortKey={state.sessionSortKey}
            sessionSortDir={state.sessionSortDir}
            sessionSearch={state.sessionSearch}
            effectiveSessionPage={effectiveSessionPage}
            sessionTotalPages={sessionTotalPages}
            onSelectSession={(id) => dispatch({ type: "SELECT_SESSION", id })}
            onSearch={(q) => dispatch({ type: "SET_SESSION_SEARCH", q })}
            onSort={(key) => dispatch({ type: "TOGGLE_SESSION_SORT", key })}
            onPagePrev={() =>
              dispatch({
                type: "SET_SESSION_PAGE",
                page: Math.max(1, effectiveSessionPage - 1),
              })
            }
            onPageNext={() =>
              dispatch({
                type: "SET_SESSION_PAGE",
                page: Math.min(sessionTotalPages, effectiveSessionPage + 1),
              })
            }
            onOpenPlayerProfile={(key) =>
              dispatch({ type: "OPEN_PLAYER_PROFILE", key })
            }
          />
        ) : (
          <PlayerView
            paginatedPlayers={paginatedPlayers}
            sortedFilteredPlayersCount={sortedFilteredPlayers.length}
            playerSearch={state.playerSearch}
            playerSortKey={state.playerSortKey}
            playerSortDir={state.playerSortDir}
            effectivePlayerPage={effectivePlayerPage}
            playerTotalPages={playerTotalPages}
            focusedPlayer={focusedPlayer}
            focusedPlayerSessions={focusedPlayerSessions}
            onSearch={(q) => dispatch({ type: "SET_PLAYER_SEARCH", q })}
            onSort={(key) => dispatch({ type: "TOGGLE_PLAYER_SORT", key })}
            onPagePrev={() =>
              dispatch({
                type: "SET_PLAYER_PAGE",
                page: Math.max(1, effectivePlayerPage - 1),
              })
            }
            onPageNext={() =>
              dispatch({
                type: "SET_PLAYER_PAGE",
                page: Math.min(playerTotalPages, effectivePlayerPage + 1),
              })
            }
            onFocusPlayer={(key) => dispatch({ type: "FOCUS_PLAYER", key })}
            onClosePlayer={() => dispatch({ type: "FOCUS_PLAYER", key: "" })}
          />
        )}
      </div>
    </main>
  );
}
