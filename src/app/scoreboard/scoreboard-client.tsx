"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faTrash,
  faUpload,
  faClockRotateLeft,
  faTableList,
  faShareNodes,
  faXmark,
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

type RosterSourceSession = {
  id: string;
  name: string | null;
  status: string;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
};

type RosterSourceGroupSlot = {
  id: string;
  position: number;
  playerName: string | null;
};

type RosterSourceGroup = {
  id: string;
  rosterIndex: number;
  groupNumber: number;
  name: string | null;
  slots: RosterSourceGroupSlot[];
};

type RosterSourcePayload = {
  sessions: RosterSourceSession[];
  selectedRosterSessionId: string | null;
  roster: {
    id: string;
    name: string | null;
    groups: RosterSourceGroup[];
  } | null;
};

type ScoreboardSessionShare = {
  shareUrl: string | null;
  updatedAt: string;
};

type ScoreboardSession = {
  id: string;
  discordGuildId: string;
  name: string | null;
  status: string;
  entries: ScoreboardEntry[];
  shares: ScoreboardSessionShare[];
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

type ScoreTotals = {
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  healingDone: number;
};

type GroupTotals = {
  groupId: string;
  groupNumber: number;
  groupName: string | null;
  totals: ScoreTotals;
  playersCount: number;
};

type RosterIndexSummary = {
  rosterIndex: number;
  groups: GroupTotals[];
  global: ScoreTotals;
  uniquePlayersCount: number;
};

type PlayerWarStats = {
  sessionId: string;
  sessionName: string;
  sessionStatus: string;
  sessionCreatedAt: string;
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  healingDone: number;
};

const SHARE_LINK_TTL_DAYS = 30;

function normalizePlayerNameKey(value: string) {
  return value.trim().toLowerCase();
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function createEmptyTotals(): ScoreTotals {
  return {
    kills: 0,
    deaths: 0,
    assists: 0,
    damageDealt: 0,
    healingDone: 0,
  };
}

function addEntryToTotals(target: ScoreTotals, entry: ScoreboardEntry) {
  target.kills += entry.kills;
  target.deaths += entry.deaths;
  target.assists += entry.assists;
  target.damageDealt += entry.damageDealt;
  target.healingDone += entry.healingDone;
}

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
          payload?.error ??
            "Impossible de charger les sessions roster pour l'import.",
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
          payload?.error ??
            "Impossible de sauvegarder la session roster selectionnee.",
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
        throw new Error(
          payload?.error ?? "Impossible de creer le lien partageable",
        );
      }

      return response.json() as Promise<{
        sessionId: string;
        shareUrl: string;
        expiresAt: string;
      }>;
    },
    onSuccess: () => {
      toast.success("Lien de partage genere");
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
        throw new Error(payload?.error ?? "Impossible de revoquer le lien");
      }
    },
    onSuccess: () => {
      toast.success("Lien de partage revoque");
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
      toast.success("Joueur retire du scoreboard");
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
                        Lien partageable du scoreboard
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
                          Revoquer
                        </LoadingButton>
                      </div>

                      {selectedShareExpiresAt ? (
                        <p className="mt-2 text-[11px] text-slate-500">
                          Expire le{" "}
                          {new Date(selectedShareExpiresAt).toLocaleString(
                            "fr-FR",
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
                      placeholder="Rechercher un joueur dans ce scoreboard"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                    />
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    {selectedRosterSessionId ? (
                      <div className="mb-4 space-y-4">
                        {rosterGroupedStats.length === 0 ? (
                          <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3 text-xs text-slate-400">
                            Aucune correspondance entre les joueurs du roster
                            selectionne et les joueurs du scoreboard.
                          </div>
                        ) : (
                          rosterGroupedStats.map((summary) => (
                            <div
                              key={summary.rosterIndex}
                              className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold text-slate-200">
                                  Roster {summary.rosterIndex}
                                </h3>
                                <span className="text-xs text-slate-400">
                                  {summary.uniquePlayersCount} joueur(s)
                                </span>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[760px] text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-800 text-left uppercase tracking-wide text-slate-500">
                                      <th className="px-2 py-2">Groupe</th>
                                      <th className="px-2 py-2">Joueurs</th>
                                      <th className="px-2 py-2">Kills</th>
                                      <th className="px-2 py-2">Deaths</th>
                                      <th className="px-2 py-2">Assists</th>
                                      <th className="px-2 py-2">Damage</th>
                                      <th className="px-2 py-2">Healing</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {summary.groups.map((group) => (
                                      <tr
                                        key={group.groupId}
                                        className="border-b border-slate-900"
                                      >
                                        <td className="px-2 py-2 text-slate-200">
                                          G{group.groupNumber}
                                          {group.groupName
                                            ? ` - ${group.groupName}`
                                            : ""}
                                        </td>
                                        <td className="px-2 py-2 text-slate-400">
                                          {group.playersCount}
                                        </td>
                                        <td className="px-2 py-2 text-slate-300">
                                          {group.totals.kills}
                                        </td>
                                        <td className="px-2 py-2 text-slate-300">
                                          {group.totals.deaths}
                                        </td>
                                        <td className="px-2 py-2 text-slate-300">
                                          {group.totals.assists}
                                        </td>
                                        <td className="px-2 py-2 text-slate-300">
                                          {group.totals.damageDealt}
                                        </td>
                                        <td className="px-2 py-2 text-slate-300">
                                          {group.totals.healingDone}
                                        </td>
                                      </tr>
                                    ))}
                                    <tr className="bg-slate-900/40 font-semibold text-slate-100">
                                      <td className="px-2 py-2">
                                        Global roster
                                      </td>
                                      <td className="px-2 py-2 text-slate-300">
                                        {summary.uniquePlayersCount}
                                      </td>
                                      <td className="px-2 py-2">
                                        {summary.global.kills}
                                      </td>
                                      <td className="px-2 py-2">
                                        {summary.global.deaths}
                                      </td>
                                      <td className="px-2 py-2">
                                        {summary.global.assists}
                                      </td>
                                      <td className="px-2 py-2">
                                        {summary.global.damageDealt}
                                      </td>
                                      <td className="px-2 py-2">
                                        {summary.global.healingDone}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}

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
                                <button
                                  type="button"
                                  onClick={() =>
                                    openPlayerStatsModal(entry.playerName)
                                  }
                                  className="mb-1 block text-left text-sm font-semibold text-sky-300 transition hover:text-sky-200"
                                >
                                  {entry.playerName}
                                </button>
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
                            <button
                              type="button"
                              onClick={() =>
                                openPlayerStatsModal(player.playerName)
                              }
                              className="text-left text-sky-300 transition hover:text-sky-200"
                            >
                              {player.playerName}
                            </button>
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

        {isPlayerStatsModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl shadow-black/60">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">
                    {selectedPlayerName}
                  </h2>
                  <p className="text-sm text-slate-400">
                    Stats globales et details par war
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closePlayerStatsModal}
                  className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-600"
                >
                  <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPlayerStatsView("global")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    playerStatsView === "global"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "border border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600"
                  }`}
                >
                  Global
                </button>
                <button
                  type="button"
                  onClick={() => setPlayerStatsView("wars")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    playerStatsView === "wars"
                      ? "bg-sky-500/20 text-sky-300"
                      : "border border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600"
                  }`}
                >
                  Wars
                </button>
              </div>

              {playerStatsView === "global" ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Wars participees
                    </p>
                    <p className="mt-1 text-xl font-semibold text-slate-100">
                      {selectedPlayerGlobalStats.warsParticipated}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Kills
                    </p>
                    <p className="mt-1 text-xl font-semibold text-slate-100">
                      {selectedPlayerGlobalStats.kills}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Deaths
                    </p>
                    <p className="mt-1 text-xl font-semibold text-slate-100">
                      {selectedPlayerGlobalStats.deaths}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Assists
                    </p>
                    <p className="mt-1 text-xl font-semibold text-slate-100">
                      {selectedPlayerGlobalStats.assists}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Damage
                    </p>
                    <p className="mt-1 text-xl font-semibold text-slate-100">
                      {selectedPlayerGlobalStats.damageDealt}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Healing
                    </p>
                    <p className="mt-1 text-xl font-semibold text-slate-100">
                      {selectedPlayerGlobalStats.healingDone}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="max-h-[55vh] overflow-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400">
                        <th className="px-2 py-2">War</th>
                        <th className="px-2 py-2">Date</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2">Kills</th>
                        <th className="px-2 py-2">Deaths</th>
                        <th className="px-2 py-2">Assists</th>
                        <th className="px-2 py-2">Damage</th>
                        <th className="px-2 py-2">Healing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPlayerWarStats.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-2 py-6 text-center text-slate-500"
                          >
                            Aucune participation trouvee.
                          </td>
                        </tr>
                      ) : (
                        selectedPlayerWarStats.map((war) => (
                          <tr
                            key={war.sessionId}
                            className="border-b border-slate-800/70"
                          >
                            <td className="px-2 py-2 text-slate-100">
                              {war.sessionName}
                            </td>
                            <td className="px-2 py-2 text-slate-400">
                              {new Date(war.sessionCreatedAt).toLocaleString(
                                "fr-FR",
                              )}
                            </td>
                            <td className="px-2 py-2 text-slate-300">
                              {war.sessionStatus}
                            </td>
                            <td className="px-2 py-2 text-slate-300">
                              {war.kills}
                            </td>
                            <td className="px-2 py-2 text-slate-300">
                              {war.deaths}
                            </td>
                            <td className="px-2 py-2 text-slate-300">
                              {war.assists}
                            </td>
                            <td className="px-2 py-2 text-slate-300">
                              {war.damageDealt}
                            </td>
                            <td className="px-2 py-2 text-slate-300">
                              {war.healingDone}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
