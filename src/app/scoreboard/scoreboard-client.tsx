"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash,
  faUpload,
  faShareNodes,
} from "@fortawesome/free-solid-svg-icons";
import { LoadingButton } from "@/components/loading-button";
import { LoadingIndicator } from "@/components/loading-indicator";
import { queryPresets } from "@/lib/query-presets";
import {
  ScoreboardPageHeader,
  ScoreboardSessionsSidebar,
} from "./scoreboard-layout";
import {
  SHARE_LINK_TTL_DAYS,
  type PlayerHistory,
  type PlayerWarStats,
  type RosterIndexSummary,
  type RosterSourcePayload,
  type ScoreField,
  type ScoreboardEntry,
  type ScoreboardSession,
  type ViewMode,
} from "./scoreboard-types";
import {
  addEntryToTotals,
  createEmptyTotals,
  normalizePlayerNameKey,
  normalizeSearchText,
} from "./scoreboard-utils";
import {
  ScoreboardHistoryTable,
  ScoreboardPlayerStatsModal,
  ScoreboardRosterSummaryBlock,
  ScoreboardSessionEntriesTable,
} from "./scoreboard-tables";

export default function ScoreboardClient() {
  const queryClient = useQueryClient();

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );

  const [sessionSearch, setSessionSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("sessions");
  const [isPlayerStatsModalOpen, setIsPlayerStatsModalOpen] = useState(false);
  const [selectedPlayerKey, setSelectedPlayerKey] = useState<string | null>(
    null,
  );
  const [selectedPlayerName, setSelectedPlayerName] = useState<string>("");
  const [playerStatsView, setPlayerStatsView] = useState<"global" | "wars">(
    "global",
  );

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["scoreboard-sessions"],
    queryFn: async () => {
      const response = await fetch("/api/scoreboard/sessions");
      if (!response.ok) {
        throw new Error("Unable to load scoreboards");
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
        throw new Error("Unable to load player history");
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

  const { data: rosterSource } = useQuery({
    queryKey: ["scoreboard-roster-source", effectiveSelectedSessionId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveSelectedSessionId) {
        params.set("scoreboardSessionId", effectiveSelectedSessionId);
      }

      const suffix = params.toString();
      const response = await fetch(
        suffix
          ? `/api/scoreboard/import-roster?${suffix}`
          : "/api/scoreboard/import-roster",
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          payload?.error ?? "Unable to load roster sessions for import.",
        );
      }

      return response.json() as Promise<RosterSourcePayload>;
    },
    enabled: Boolean(effectiveSelectedSessionId),
    ...queryPresets.shortLived,
  });

  const selectedRosterSessionId = rosterSource?.selectedRosterSessionId ?? null;

  const selectRosterSessionMutation = useMutation({
    mutationFn: async (payload: {
      scoreboardSessionId: string;
      rosterSessionId: string;
    }) => {
      const response = await fetch("/api/scoreboard/import-roster", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          payload?.error ?? "Unable to save selected roster session.",
        );
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["scoreboard-roster-source", effectiveSelectedSessionId],
        exact: false,
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const visibleSessionEntries = useMemo(() => {
    const entries = selectedSession?.entries ?? [];
    const needle = normalizeSearchText(sessionSearch);

    const filtered = needle
      ? entries.filter((entry) =>
          normalizeSearchText(entry.playerName).includes(needle),
        )
      : entries;

    return [...filtered].sort((a, b) => {
      if (b.kills !== a.kills) return b.kills - a.kills;
      if (b.assists !== a.assists) return b.assists - a.assists;
      return a.playerName.localeCompare(b.playerName);
    });
  }, [selectedSession?.entries, sessionSearch]);

  const visibleHistoryPlayers = useMemo(() => {
    const needle = normalizeSearchText(historySearch);

    const filtered = needle
      ? historyPlayers.filter((player) =>
          normalizeSearchText(player.playerName).includes(needle),
        )
      : historyPlayers;

    return [...filtered].sort((a, b) => {
      if (b.kills !== a.kills) return b.kills - a.kills;
      if (b.assists !== a.assists) return b.assists - a.assists;
      return a.playerName.localeCompare(b.playerName);
    });
  }, [historyPlayers, historySearch]);

  const selectedPlayerWarStats = useMemo(() => {
    if (!selectedPlayerKey) {
      return [] as PlayerWarStats[];
    }

    return sessions
      .map((session) => {
        const entry = session.entries.find(
          (item) =>
            normalizePlayerNameKey(item.playerName) === selectedPlayerKey,
        );

        if (!entry) {
          return null;
        }

        return {
          sessionId: session.id,
          sessionName: session.name ?? "Scoreboard sans nom",
          sessionStatus: session.status,
          sessionCreatedAt: session.createdAt,
          kills: entry.kills,
          deaths: entry.deaths,
          assists: entry.assists,
          damageDealt: entry.damageDealt,
          healingDone: entry.healingDone,
        };
      })
      .filter((value): value is PlayerWarStats => Boolean(value))
      .sort(
        (a, b) =>
          new Date(b.sessionCreatedAt).getTime() -
          new Date(a.sessionCreatedAt).getTime(),
      );
  }, [selectedPlayerKey, sessions]);

  const selectedPlayerGlobalStats = useMemo(() => {
    const totals = createEmptyTotals();

    for (const war of selectedPlayerWarStats) {
      totals.kills += war.kills;
      totals.deaths += war.deaths;
      totals.assists += war.assists;
      totals.damageDealt += war.damageDealt;
      totals.healingDone += war.healingDone;
    }

    return {
      ...totals,
      warsParticipated: selectedPlayerWarStats.length,
    };
  }, [selectedPlayerWarStats]);

  const rosterGroupedStats = useMemo(() => {
    const rosterGroups = rosterSource?.roster?.groups ?? [];
    const entries = selectedSession?.entries ?? [];

    if (rosterGroups.length === 0 || entries.length === 0) {
      return [] as RosterIndexSummary[];
    }

    const entryByPlayerKey = new Map<string, ScoreboardEntry>();

    for (const entry of entries) {
      entryByPlayerKey.set(normalizePlayerNameKey(entry.playerName), entry);
    }

    const byRosterIndex = new Map<number, RosterIndexSummary>();

    for (const group of rosterGroups) {
      const summary =
        byRosterIndex.get(group.rosterIndex) ??
        (() => {
          const created: RosterIndexSummary = {
            rosterIndex: group.rosterIndex,
            groups: [],
            global: createEmptyTotals(),
            uniquePlayersCount: 0,
          };
          byRosterIndex.set(group.rosterIndex, created);
          return created;
        })();

      const groupTotals = createEmptyTotals();
      const countedGroupPlayers = new Set<string>();

      for (const slot of group.slots) {
        const playerName = slot.playerName?.trim();
        if (!playerName) continue;

        const playerKey = normalizePlayerNameKey(playerName);
        const entry = entryByPlayerKey.get(playerKey);
        if (!entry) continue;

        addEntryToTotals(groupTotals, entry);
        countedGroupPlayers.add(playerKey);
      }

      summary.groups.push({
        groupId: group.id,
        groupNumber: group.groupNumber,
        groupName: group.name,
        totals: groupTotals,
        playersCount: countedGroupPlayers.size,
      });
    }

    for (const summary of byRosterIndex.values()) {
      const uniqueRosterPlayers = new Set<string>();

      for (const group of rosterGroups.filter(
        (item) => item.rosterIndex === summary.rosterIndex,
      )) {
        for (const slot of group.slots) {
          const playerName = slot.playerName?.trim();
          if (!playerName) continue;

          const playerKey = normalizePlayerNameKey(playerName);
          if (uniqueRosterPlayers.has(playerKey)) continue;

          uniqueRosterPlayers.add(playerKey);

          const entry = entryByPlayerKey.get(playerKey);
          if (!entry) continue;

          addEntryToTotals(summary.global, entry);
        }
      }

      summary.uniquePlayersCount = uniqueRosterPlayers.size;
      summary.groups.sort((a, b) => a.groupNumber - b.groupNumber);
    }

    return Array.from(byRosterIndex.values()).sort(
      (a, b) => a.rosterIndex - b.rosterIndex,
    );
  }, [rosterSource?.roster?.groups, selectedSession?.entries]);

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/scoreboard/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error("Unable to create scoreboard");
      }

      return response.json() as Promise<ScoreboardSession>;
    },
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ["scoreboard-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["scoreboard-history"] });
      setSelectedSessionId(newSession.id);
      toast.success("Scoreboard created");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createShareLinkMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(
        `/api/scoreboard/sessions/${sessionId}/share`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Unable to create share link");
      }

      return response.json() as Promise<{
        sessionId: string;
        shareUrl: string;
        expiresAt: string;
      }>;
    },
    onSuccess: () => {
      toast.success("Share link generated");
      queryClient.invalidateQueries({ queryKey: ["scoreboard-sessions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revokeShareLinkMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(
        `/api/scoreboard/sessions/${sessionId}/share`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Unable to revoke share link");
      }
    },
    onSuccess: () => {
      toast.success("Share link revoked");
      queryClient.invalidateQueries({ queryKey: ["scoreboard-sessions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/scoreboard/sessions/${sessionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Unable to delete this scoreboard");
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
    mutationFn: async (payload: {
      sessionId: string;
      rosterSessionId: string | null;
    }) => {
      const response = await fetch("/api/scoreboard/import-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: payload.sessionId,
          rosterIndex: "all",
          rosterSessionId: payload.rosterSessionId ?? undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Unable to import roster");
      }

      return response.json() as Promise<{ imported: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["scoreboard-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["scoreboard-history"] });
      toast.success(`${data.imported} player(s) imported`);
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
        throw new Error(json?.error ?? "Update failed");
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
        throw new Error(payload?.error ?? "Deletion failed");
      }
    },
    onMutate: async (entryId: string) => {
      await queryClient.cancelQueries({ queryKey: ["scoreboard-sessions"] });
      const previous = queryClient.getQueryData<ScoreboardSession[]>([
        "scoreboard-sessions",
      ]);
      queryClient.setQueryData<ScoreboardSession[]>(
        ["scoreboard-sessions"],
        (old) =>
          old?.map((session) => ({
            ...session,
            entries: session.entries.filter((e) => e.id !== entryId),
          })) ?? [],
      );
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoreboard-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["scoreboard-history"] });
      toast.success("Player removed from scoreboard");
    },
    onError: (error: Error, _entryId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["scoreboard-sessions"], context.previous);
      }
      toast.error(error.message);
    },
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
        throw new Error("Unable to update scoreboard");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoreboard-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["scoreboard-history"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openPlayerStatsModal(playerName: string) {
    setSelectedPlayerName(playerName);
    setSelectedPlayerKey(normalizePlayerNameKey(playerName));
    setPlayerStatsView("global");
    setIsPlayerStatsModalOpen(true);
  }

  function closePlayerStatsModal() {
    setIsPlayerStatsModalOpen(false);
  }

  const selectedShare = selectedSession?.shares?.[0] ?? null;
  const selectedSharedLink = selectedShare?.shareUrl ?? "";
  const selectedShareExpiresAt = selectedShare
    ? new Date(
        new Date(selectedShare.updatedAt).getTime() +
          SHARE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString()
    : "";

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
        <ScoreboardPageHeader
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
        />

        {viewMode === "sessions" ? (
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
            <ScoreboardSessionsSidebar
              sessions={sessions}
              selectedSessionId={selectedSessionId}
              isCreatingSession={createSessionMutation.isPending}
              onCreateSession={() => createSessionMutation.mutate()}
              onSelectSession={setSelectedSessionId}
            />

            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/30 backdrop-blur">
              {!selectedSession ? (
                <p className="text-sm text-slate-400">
                  Select a scoreboard to get started.
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
                      <select
                        value={selectedRosterSessionId ?? ""}
                        onChange={(event) => {
                          const scoreboardSessionId = selectedSession.id;
                          if (!scoreboardSessionId) {
                            return;
                          }

                          const nextValue = event.target.value.trim();
                          if (!nextValue) {
                            return;
                          }

                          selectRosterSessionMutation.mutate({
                            scoreboardSessionId,
                            rosterSessionId: nextValue,
                          });
                        }}
                        disabled={
                          selectRosterSessionMutation.isPending ||
                          (rosterSource?.sessions.length ?? 0) === 0
                        }
                        className="max-w-[240px] rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                      >
                        {(rosterSource?.sessions ?? []).map((session) => (
                          <option key={session.id} value={session.id}>
                            {session.name ?? "Session sans nom"}
                          </option>
                        ))}
                      </select>

                      <LoadingButton
                        isLoading={importRosterMutation.isPending}
                        onClick={() => {
                          importRosterMutation.mutate({
                            sessionId: selectedSession.id,
                            rosterSessionId: selectedRosterSessionId,
                          });
                        }}
                        disabled={
                          !selectedRosterSessionId ||
                          (rosterSource?.sessions.length ?? 0) === 0
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
                    <div className="w-full rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                        Scoreboard share link
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        <LoadingButton
                          isLoading={createShareLinkMutation.isPending}
                          onClick={() => {
                            if (!selectedSession?.id) return;
                            createShareLinkMutation.mutate(selectedSession.id);
                          }}
                          disabled={!selectedSession?.id}
                          className="rounded-lg border border-indigo-600/40 bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/30"
                        >
                          <FontAwesomeIcon
                            icon={faShareNodes}
                            className="h-3 w-3"
                          />
                          Creer lien
                        </LoadingButton>

                        <input
                          readOnly
                          value={selectedSharedLink}
                          placeholder="Genere un lien de partage pour cette session"
                          className="min-w-[260px] flex-1 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-slate-100 outline-none"
                        />

                        <button
                          type="button"
                          disabled={!selectedSharedLink}
                          onClick={() => {
                            if (!selectedSharedLink) return;
                            void navigator.clipboard.writeText(
                              selectedSharedLink,
                            );
                            toast.success("Lien copie");
                          }}
                          className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Copier
                        </button>

                        <LoadingButton
                          isLoading={revokeShareLinkMutation.isPending}
                          onClick={() => {
                            if (!selectedSession?.id) return;
                            revokeShareLinkMutation.mutate(selectedSession.id);
                          }}
                          disabled={!selectedSession?.id || !selectedSharedLink}
                          className="rounded-lg border border-red-600/40 bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/30"
                        >
                          Revoke
                        </LoadingButton>
                      </div>

                      {selectedShareExpiresAt ? (
                        <p className="mt-2 text-[11px] text-slate-500">
                          Expires on{" "}
                          {new Date(selectedShareExpiresAt).toLocaleString(
                            "en-US",
                          )}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4">
                    <input
                      type="text"
                      value={sessionSearch}
                      onChange={(event) => setSessionSearch(event.target.value)}
                      placeholder="Search player in this scoreboard"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                    />
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <ScoreboardRosterSummaryBlock
                      selectedRosterSessionId={selectedRosterSessionId}
                      rosterGroupedStats={rosterGroupedStats}
                    />

                    <ScoreboardSessionEntriesTable
                      entries={visibleSessionEntries}
                      onOpenPlayerStats={openPlayerStatsModal}
                      onRenamePlayer={(entryId, currentName, nextName) => {
                        if (!nextName || nextName === currentName) {
                          return;
                        }

                        updateEntryMutation.mutate({
                          entryId,
                          updates: { playerName: nextName },
                        });
                      }}
                      onSubmitStat={submitStat}
                      onDeleteEntry={(entryId) =>
                        deleteEntryMutation.mutate(entryId)
                      }
                    />
                  </div>
                </>
              )}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/30 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-100">
                Global stats per player
              </h2>
              <input
                type="text"
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Search player"
                className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
              />
            </div>

            {historyLoading ? (
              <div className="mt-6">
                <LoadingIndicator />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <ScoreboardHistoryTable
                  players={visibleHistoryPlayers}
                  onOpenPlayerStats={openPlayerStatsModal}
                />
              </div>
            )}
          </section>
        )}

        <ScoreboardPlayerStatsModal
          isOpen={isPlayerStatsModalOpen}
          playerName={selectedPlayerName}
          playerStatsView={playerStatsView}
          onClose={closePlayerStatsModal}
          onChangeView={setPlayerStatsView}
          selectedPlayerGlobalStats={selectedPlayerGlobalStats}
          selectedPlayerWarStats={selectedPlayerWarStats}
        />
      </div>
    </main>
  );
}
