"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUsers,
  faPlus,
  faTrash,
  faUpload,
  faClockRotateLeft,
  faTableList,
} from "@fortawesome/free-solid-svg-icons";
import { LoadingButton } from "@/components/loading-button";
import { LoadingIndicator } from "@/components/loading-indicator";
import { queryPresets } from "@/lib/query-presets";

type ScoreboardEntry = {
  id: string;
  sessionId: string;
  playerName: string;
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  healingDone: number;
  createdAt: string;
  updatedAt: string;
};

type ScoreboardSession = {
  id: string;
  discordGuildId: string;
  name: string | null;
  status: string;
  entries: ScoreboardEntry[];
  createdAt: string;
  updatedAt: string;
};

type PlayerHistory = {
  playerName: string;
  sessionsPlayed: number;
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  healingDone: number;
  updatedAt: string;
};

type ViewMode = "sessions" | "history";

type ScoreField =
  | "kills"
  | "deaths"
  | "assists"
  | "damageDealt"
  | "healingDone";

export default function ScoreboardClient() {
  const queryClient = useQueryClient();

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [newPlayerName, setNewPlayerName] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("sessions");

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["scoreboard-sessions"],
    queryFn: async () => {
      const response = await fetch("/api/scoreboard/sessions");
      if (!response.ok) {
        throw new Error("Impossible de charger les scoreboards");
      }
      return response.json() as Promise<ScoreboardSession[]>;
    },
    ...queryPresets.shortLived,
  });

  const { data: historyPlayers = [], isLoading: historyLoading } = useQuery({
    queryKey: ["scoreboard-history"],
    queryFn: async () => {
      const response = await fetch("/api/scoreboard/history");
      if (!response.ok) {
        throw new Error("Impossible de charger l'historique joueur");
      }
      const payload = (await response.json()) as { players: PlayerHistory[] };
      return payload.players;
    },
    ...queryPresets.shortLived,
  });

  useEffect(() => {
    const source = new EventSource("/api/live-updates");

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          topic?: string;
        };

        if (payload.type === "update" && payload.topic === "scoreboard") {
          queryClient.invalidateQueries({ queryKey: ["scoreboard-sessions"] });
          queryClient.invalidateQueries({ queryKey: ["scoreboard-history"] });
        }
      } catch {
        // Ignore malformed SSE payloads.
      }
    };

    return () => {
      source.close();
    };
  }, [queryClient]);

  const effectiveSelectedSessionId = useMemo(() => {
    if (
      selectedSessionId &&
      sessions.some((session) => session.id === selectedSessionId)
    ) {
      return selectedSessionId;
    }

    return sessions[0]?.id ?? null;
  }, [selectedSessionId, sessions]);

  const selectedSession = useMemo(
    () =>
      sessions.find((session) => session.id === effectiveSelectedSessionId) ??
      null,
    [effectiveSelectedSessionId, sessions],
  );

  const visibleSessionEntries = useMemo(() => {
    const entries = selectedSession?.entries ?? [];
    const needle = sessionSearch.trim().toLowerCase();

    const filtered = needle
      ? entries.filter((entry) =>
          entry.playerName.toLowerCase().includes(needle),
        )
      : entries;

    return [...filtered].sort((a, b) => {
      if (b.kills !== a.kills) return b.kills - a.kills;
      if (b.assists !== a.assists) return b.assists - a.assists;
      return a.playerName.localeCompare(b.playerName);
    });
  }, [selectedSession?.entries, sessionSearch]);

  const visibleHistoryPlayers = useMemo(() => {
    const needle = historySearch.trim().toLowerCase();

    const filtered = needle
      ? historyPlayers.filter((player) =>
          player.playerName.toLowerCase().includes(needle),
        )
      : historyPlayers;

    return [...filtered].sort((a, b) => {
      if (b.kills !== a.kills) return b.kills - a.kills;
      if (b.assists !== a.assists) return b.assists - a.assists;
      return a.playerName.localeCompare(b.playerName);
    });
  }, [historyPlayers, historySearch]);

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/scoreboard/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error("Impossible de creer un scoreboard");
      }

      return response.json() as Promise<ScoreboardSession>;
    },
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ["scoreboard-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["scoreboard-history"] });
      setSelectedSessionId(newSession.id);
      toast.success("Scoreboard cree");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/scoreboard/sessions/${sessionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Impossible de supprimer ce scoreboard");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoreboard-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["scoreboard-history"] });
      toast.success("Scoreboard supprime");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const importRosterMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch("/api/scoreboard/import-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, rosterIndex: "all" }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Import roster impossible");
      }

      return response.json() as Promise<{ imported: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["scoreboard-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["scoreboard-history"] });
      toast.success(`${data.imported} joueur(s) importe(s)`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addEntryMutation = useMutation({
    mutationFn: async (payload: { sessionId: string; playerName: string }) => {
      const response = await fetch("/api/scoreboard/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Impossible d'ajouter le joueur");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoreboard-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["scoreboard-history"] });
      setNewPlayerName("");
      toast.success("Joueur ajoute");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateEntryMutation = useMutation({
    mutationFn: async (payload: {
      entryId: string;
      updates: Partial<
        Pick<
          ScoreboardEntry,
          | "playerName"
          | "kills"
          | "deaths"
          | "assists"
          | "damageDealt"
          | "healingDone"
        >
      >;
    }) => {
      const response = await fetch("/api/scoreboard/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(json?.error ?? "Erreur de mise a jour");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoreboard-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["scoreboard-history"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const response = await fetch("/api/scoreboard/entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Suppression impossible");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoreboard-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["scoreboard-history"] });
      toast.success("Joueur retire du scoreboard");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateSessionMutation = useMutation({
    mutationFn: async (payload: {
      sessionId: string;
      updates: { name?: string | null; status?: string };
    }) => {
      const response = await fetch(
        `/api/scoreboard/sessions/${payload.sessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload.updates),
        },
      );

      if (!response.ok) {
        throw new Error("Impossible de mettre a jour le scoreboard");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoreboard-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["scoreboard-history"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function parseStatValue(value: string) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
      return 0;
    }
    return Math.max(0, parsed);
  }

  function submitStat(
    entryId: string,
    field: ScoreField,
    rawValue: string,
    currentValue: number,
  ) {
    const parsed = parseStatValue(rawValue);
    if (parsed === currentValue) {
      return;
    }

    updateEntryMutation.mutate({
      entryId,
      updates: { [field]: parsed },
    });
  }

  if (sessionsLoading) {
    return (
      <div className="flex min-h-[calc(100vh_-_64px)] items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-8">
        <LoadingIndicator />
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh_-_64px)] w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/30 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-100">
                Scoreboard
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Saisie des stats de combat et historique joueur.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("sessions")}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  viewMode === "sessions"
                    ? "bg-sky-500/20 text-sky-300"
                    : "border border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600"
                }`}
              >
                <FontAwesomeIcon icon={faTableList} className="mr-2 h-4 w-4" />
                Scoreboards
              </button>
              <button
                type="button"
                onClick={() => setViewMode("history")}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  viewMode === "history"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "border border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600"
                }`}
              >
                <FontAwesomeIcon
                  icon={faClockRotateLeft}
                  className="mr-2 h-4 w-4"
                />
                Historique joueur
              </button>
            </div>
          </div>
        </div>

        {viewMode === "sessions" ? (
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
            <aside className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl shadow-black/30 backdrop-blur">
              <LoadingButton
                isLoading={createSessionMutation.isPending}
                onClick={() => createSessionMutation.mutate()}
                className="mb-4 w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500"
              >
                <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
                Nouveau scoreboard
              </LoadingButton>

              <div className="space-y-2">
                {sessions.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Aucun scoreboard pour le moment.
                  </p>
                ) : (
                  sessions.map((session) => {
                    const isSelected = session.id === selectedSessionId;
                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => setSelectedSessionId(session.id)}
                        className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                          isSelected
                            ? "border-sky-500/60 bg-sky-500/10"
                            : "border-slate-700 bg-slate-800/40 hover:border-slate-600"
                        }`}
                      >
                        <p className="truncate text-sm font-semibold text-slate-200">
                          {session.name || "Scoreboard sans nom"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(session.createdAt).toLocaleDateString(
                            "fr-FR",
                          )}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {session.entries.length} joueur(s)
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/30 backdrop-blur">
              {!selectedSession ? (
                <p className="text-sm text-slate-400">
                  Selectionne un scoreboard pour commencer.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-[220px] flex-1 items-center gap-2">
                      <input
                        type="text"
                        defaultValue={selectedSession.name ?? ""}
                        onBlur={(event) => {
                          const nextName = event.target.value.trim();
                          const currentName =
                            selectedSession.name?.trim() ?? "";
                          if (nextName !== currentName) {
                            updateSessionMutation.mutate({
                              sessionId: selectedSession.id,
                              updates: { name: nextName || null },
                            });
                          }
                        }}
                        placeholder="Nom du scoreboard"
                        className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                      />

                      <select
                        value={selectedSession.status}
                        onChange={(event) =>
                          updateSessionMutation.mutate({
                            sessionId: selectedSession.id,
                            updates: { status: event.target.value },
                          })
                        }
                        className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                      >
                        <option value="DRAFT">DRAFT</option>
                        <option value="CLOSED">CLOSED</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <LoadingButton
                        isLoading={importRosterMutation.isPending}
                        onClick={() =>
                          importRosterMutation.mutate(selectedSession.id)
                        }
                        className="rounded-lg border border-indigo-600/40 bg-indigo-500/20 px-3 py-2 text-sm font-semibold text-indigo-200 hover:bg-indigo-500/30"
                      >
                        <FontAwesomeIcon icon={faUpload} className="h-4 w-4" />
                        Importer groupes
                      </LoadingButton>

                      <LoadingButton
                        isLoading={deleteSessionMutation.isPending}
                        onClick={() =>
                          deleteSessionMutation.mutate(selectedSession.id)
                        }
                        className="rounded-lg border border-red-600/40 bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/30"
                      >
                        <FontAwesomeIcon icon={faTrash} className="h-4 w-4" />
                        Supprimer
                      </LoadingButton>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={newPlayerName}
                      onChange={(event) => setNewPlayerName(event.target.value)}
                      placeholder="Ajouter un joueur"
                      className="min-w-[220px] flex-1 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                    />
                    <LoadingButton
                      isLoading={addEntryMutation.isPending}
                      onClick={() => {
                        if (!effectiveSelectedSessionId) return;
                        addEntryMutation.mutate({
                          sessionId: effectiveSelectedSessionId,
                          playerName: newPlayerName,
                        });
                      }}
                      className="rounded-lg border border-emerald-600/40 bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30"
                    >
                      <FontAwesomeIcon icon={faUsers} className="h-4 w-4" />
                      Ajouter
                    </LoadingButton>
                  </div>

                  <div className="mt-4">
                    <input
                      type="text"
                      value={sessionSearch}
                      onChange={(event) => setSessionSearch(event.target.value)}
                      placeholder="Rechercher un joueur dans ce scoreboard"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                    />
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead>
                        <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400">
                          <th className="px-2 py-2">Joueur</th>
                          <th className="px-2 py-2">Kills</th>
                          <th className="px-2 py-2">Deaths</th>
                          <th className="px-2 py-2">Assists</th>
                          <th className="px-2 py-2">Damage</th>
                          <th className="px-2 py-2">Healing</th>
                          <th className="px-2 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleSessionEntries.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-2 py-6 text-center text-slate-500"
                            >
                              Aucun joueur dans ce scoreboard.
                            </td>
                          </tr>
                        ) : (
                          visibleSessionEntries.map((entry) => (
                            <tr
                              key={entry.id}
                              className="border-b border-slate-800/70"
                            >
                              <td className="px-2 py-2">
                                <input
                                  type="text"
                                  defaultValue={entry.playerName}
                                  onBlur={(event) => {
                                    const nextValue = event.target.value.trim();
                                    if (
                                      !nextValue ||
                                      nextValue === entry.playerName
                                    ) {
                                      return;
                                    }
                                    updateEntryMutation.mutate({
                                      entryId: entry.id,
                                      updates: { playerName: nextValue },
                                    });
                                  }}
                                  className="w-full rounded border border-slate-700 bg-slate-800/50 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-slate-500"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  defaultValue={entry.kills}
                                  onBlur={(event) =>
                                    submitStat(
                                      entry.id,
                                      "kills",
                                      event.target.value,
                                      entry.kills,
                                    )
                                  }
                                  className="w-24 rounded border border-slate-700 bg-slate-800/50 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-slate-500"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  defaultValue={entry.deaths}
                                  onBlur={(event) =>
                                    submitStat(
                                      entry.id,
                                      "deaths",
                                      event.target.value,
                                      entry.deaths,
                                    )
                                  }
                                  className="w-24 rounded border border-slate-700 bg-slate-800/50 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-slate-500"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  defaultValue={entry.assists}
                                  onBlur={(event) =>
                                    submitStat(
                                      entry.id,
                                      "assists",
                                      event.target.value,
                                      entry.assists,
                                    )
                                  }
                                  className="w-24 rounded border border-slate-700 bg-slate-800/50 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-slate-500"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  defaultValue={entry.damageDealt}
                                  onBlur={(event) =>
                                    submitStat(
                                      entry.id,
                                      "damageDealt",
                                      event.target.value,
                                      entry.damageDealt,
                                    )
                                  }
                                  className="w-32 rounded border border-slate-700 bg-slate-800/50 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-slate-500"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  defaultValue={entry.healingDone}
                                  onBlur={(event) =>
                                    submitStat(
                                      entry.id,
                                      "healingDone",
                                      event.target.value,
                                      entry.healingDone,
                                    )
                                  }
                                  className="w-32 rounded border border-slate-700 bg-slate-800/50 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-slate-500"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteEntryMutation.mutate(entry.id)
                                  }
                                  className="rounded border border-red-600/40 bg-red-500/10 px-2 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
                                >
                                  <FontAwesomeIcon
                                    icon={faTrash}
                                    className="mr-1 h-3 w-3"
                                  />
                                  Retirer
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/30 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-100">
                Stats globales par joueur
              </h2>
              <input
                type="text"
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Rechercher un joueur"
                className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
              />
            </div>

            {historyLoading ? (
              <div className="mt-6">
                <LoadingIndicator />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[960px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-2 py-2">Joueur</th>
                      <th className="px-2 py-2">Sessions</th>
                      <th className="px-2 py-2">Kills</th>
                      <th className="px-2 py-2">Deaths</th>
                      <th className="px-2 py-2">Assists</th>
                      <th className="px-2 py-2">Damage</th>
                      <th className="px-2 py-2">Healing</th>
                      <th className="px-2 py-2">Derniere maj</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleHistoryPlayers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-2 py-6 text-center text-slate-500"
                        >
                          Aucun resultat dans l&apos;historique.
                        </td>
                      </tr>
                    ) : (
                      visibleHistoryPlayers.map((player) => (
                        <tr
                          key={player.playerName}
                          className="border-b border-slate-800/70"
                        >
                          <td className="px-2 py-2 font-medium text-slate-100">
                            {player.playerName}
                          </td>
                          <td className="px-2 py-2 text-slate-300">
                            {player.sessionsPlayed}
                          </td>
                          <td className="px-2 py-2 text-slate-300">
                            {player.kills}
                          </td>
                          <td className="px-2 py-2 text-slate-300">
                            {player.deaths}
                          </td>
                          <td className="px-2 py-2 text-slate-300">
                            {player.assists}
                          </td>
                          <td className="px-2 py-2 text-slate-300">
                            {player.damageDealt}
                          </td>
                          <td className="px-2 py-2 text-slate-300">
                            {player.healingDone}
                          </td>
                          <td className="px-2 py-2 text-slate-400">
                            {new Date(player.updatedAt).toLocaleString("fr-FR")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
