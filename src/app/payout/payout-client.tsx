"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faTrash,
  faCheck,
  faXmark,
  faDownload,
  faUsers,
  faLock,
  faLockOpen,
  faPencil,
  faShareNodes,
  faCopy,
  faLinkSlash,
} from "@fortawesome/free-solid-svg-icons";
import { LoadingButton } from "@/components/loading-button";
import { LoadingIndicator } from "@/components/loading-indicator";
import { queryPresets } from "@/lib/query-presets";

interface PayoutSessionShare {
  shareUrl: string | null;
  updatedAt: string;
}

interface PayoutSession {
  id: string;
  discordGuildId: string;
  goldPool: number;
  status: string;
  name: string | null;
  isLocked: boolean;
  lockedByUserId: string | null;
  entries: PayoutEntry[];
  shares: PayoutSessionShare[];
  createdAt: string;
  updatedAt: string;
}

interface PayoutEntry {
  id: string;
  sessionId: string;
  discordGuildId: string;
  discordUserId: string;
  username: string;
  displayName: string | null;
  wars: number;
  races: number;
  reviews: number;
  bonus: number;
  invasions: number;
  vods: number;
  isPaid: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DiscordUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
}

const PLAYERS_PER_PAGE = 25;

export default function PayoutClient() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [selectedGoldPoolInput, setSelectedGoldPoolInput] =
    useState<string>("0");
  const [deleteSessionModalOpen, setDeleteSessionModalOpen] =
    useState<boolean>(false);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(
    null,
  );
  const [renameInput, setRenameInput] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [playerSearchQuery, setPlayerSearchQuery] = useState<string>("");
  const [currentPlayersPage, setCurrentPlayersPage] = useState<number>(1);
  const [sharedLinkBySession, setSharedLinkBySession] = useState<
    Record<string, string>
  >({});
  const [shareExpiresAtBySession, setShareExpiresAtBySession] = useState<
    Record<string, string>
  >({});
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);

  // Local state for counter inputs with debounce
  const [counterEdits, setCounterEdits] = useState<
    Record<string, Partial<PayoutEntry>>
  >({});
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const updateEntryMutateRef = useRef<
    ((data: { entryId: string; updates: Partial<PayoutEntry> }) => void) | null
  >(null);

  const queryClient = useQueryClient();

  // Debounced update function — one timer per (entryId, field) to avoid cross-field rollbacks
  const debouncedUpdate = useCallback(
    (entryId: string, field: string, value: number) => {
      const timerKey = `${entryId}-${field}`;

      if (debounceTimers.current[timerKey]) {
        clearTimeout(debounceTimers.current[timerKey]);
      }

      debounceTimers.current[timerKey] = setTimeout(() => {
        updateEntryMutateRef.current?.({
          entryId,
          updates: { [field]: value } as Partial<PayoutEntry>,
        });
        // Only clear this specific field from local edits
        setCounterEdits((prev) => {
          const entry = prev[entryId];
          if (!entry) return prev;
          const next = { ...entry };
          delete next[field as keyof PayoutEntry];
          if (Object.keys(next).length === 0) {
            const top = { ...prev };
            delete top[entryId];
            return top;
          }
          return { ...prev, [entryId]: next };
        });
      }, 300);
    },
    [],
  );

  // Update local state and trigger debounced mutation
  const handleCounterChange = useCallback(
    (entryId: string, field: string, value: number) => {
      setCounterEdits((prev) => ({
        ...prev,
        [entryId]: {
          ...(prev[entryId] || {}),
          [field]: value,
        },
      }));
      debouncedUpdate(entryId, field, value);
    },
    [debouncedUpdate],
  );

  // Fetch current user access state (includes selected guild)
  const { data: currentUserAccess } = useQuery({
    queryKey: ["current-user-access"],
    queryFn: async () => {
      const res = await fetch("/api/me");
      if (!res.ok) return null;
      return (await res.json()) as {
        user: { id: string };
        selectedGuildId: string | null;
      };
    },
    ...queryPresets.longLived,
  });

  const currentUserId = currentUserAccess?.user?.id ?? null;
  const selectedGuildId = currentUserAccess?.selectedGuildId ?? null;
  const payoutSessionsQueryKey = useMemo(
    () => ["payout-sessions", selectedGuildId ?? "none"],
    [selectedGuildId],
  );
  const guildConfigQueryKey = useMemo(
    () => ["guild-config", selectedGuildId ?? "none"],
    [selectedGuildId],
  );

  // Fetch sessions
  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: payoutSessionsQueryKey,
    queryFn: async () => {
      if (!selectedGuildId) return [];
      const res = await fetch(
        `/api/payout/sessions?guildId=${encodeURIComponent(selectedGuildId)}`,
      );
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json() as Promise<PayoutSession[]>;
    },
    enabled: Boolean(selectedGuildId),
    ...queryPresets.shortLived,
  });

  // Fetch guild config for multipliers
  const { data: guildConfig } = useQuery({
    queryKey: guildConfigQueryKey,
    queryFn: async () => {
      if (!selectedGuildId) return null;
      const res = await fetch(
        `/api/guild-config?guildId=${encodeURIComponent(selectedGuildId)}`,
      );
      if (!res.ok) throw new Error("Failed to fetch config");
      return res.json();
    },
    enabled: Boolean(selectedGuildId),
    ...queryPresets.mediumLived,
  });

  // Search Discord users
  const { data: searchResults = [] } = useQuery({
    queryKey: ["discord-search", selectedGuildId ?? "none", searchQuery],
    queryFn: async () => {
      if (!selectedGuildId || searchQuery.length < 2) return [];
      const res = await fetch(
        `/api/discord/users/search?q=${encodeURIComponent(searchQuery)}&guildId=${encodeURIComponent(selectedGuildId)}`,
      );
      if (!res.ok) return [];
      return res.json() as Promise<DiscordUser[]>;
    },
    enabled: Boolean(selectedGuildId) && searchQuery.length >= 2,
    ...queryPresets.search,
  });

  // Create session
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGuildId) throw new Error("No guild selected");
      const res = await fetch("/api/payout/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId: selectedGuildId }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      return res.json();
    },
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: payoutSessionsQueryKey });
      setSelectedSessionId(newSession.id);
      toast.success("Session created");
    },
    onError: () => toast.error("Error while creating session"),
  });

  // Update selected session settings (gold pool / status)
  const updateSessionMutation = useMutation({
    mutationFn: async (data: {
      sessionId: string;
      updates: {
        goldPool?: number;
        status?: string;
      };
    }) => {
      const res = await fetch(`/api/payout/sessions/${data.sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data.updates, guildId: selectedGuildId }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Failed to update session");
      }

      return res.json() as Promise<PayoutSession>;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(payoutSessionsQueryKey, (old: PayoutSession[]) =>
        old.map((session) => (session.id === updated.id ? updated : session)),
      );
      toast.success("Session updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!selectedGuildId) throw new Error("No guild selected");
      const res = await fetch(
        `/api/payout/sessions/${sessionId}?guildId=${encodeURIComponent(selectedGuildId)}`,
        {
          method: "DELETE",
        },
      );

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Failed to delete session");
      }

      return res.json() as Promise<{ success: boolean }>;
    },
    onSuccess: (_, deletedSessionId) => {
      queryClient.setQueryData(payoutSessionsQueryKey, (old: PayoutSession[]) =>
        old.filter((session) => session.id !== deletedSessionId),
      );
      if (selectedSessionId === deletedSessionId) {
        setSelectedSessionId(null);
      }
      setDeleteSessionModalOpen(false);
      toast.success("Session deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Toggle lock
  const toggleLockMutation = useMutation({
    mutationFn: async ({
      sessionId,
      isLocked,
    }: {
      sessionId: string;
      isLocked: boolean;
    }) => {
      const res = await fetch(`/api/payout/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isLocked, guildId: selectedGuildId }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Failed to update lock");
      }
      return res.json() as Promise<PayoutSession>;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(payoutSessionsQueryKey, (old: PayoutSession[]) =>
        old.map((s) => (s.id === updated.id ? updated : s)),
      );
      toast.success(updated.isLocked ? "Session locked" : "Session unlocked");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Rename session
  const renameSessionMutation = useMutation({
    mutationFn: async ({
      sessionId,
      name,
    }: {
      sessionId: string;
      name: string;
    }) => {
      const res = await fetch(`/api/payout/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          guildId: selectedGuildId,
        }),
      });
      if (!res.ok) throw new Error("Failed to rename session");
      return res.json() as Promise<PayoutSession>;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(payoutSessionsQueryKey, (old: PayoutSession[]) =>
        old.map((s) => (s.id === updated.id ? updated : s)),
      );
      setRenamingSessionId(null);
      toast.success("Session renamed");
    },
    onError: () => toast.error("Error while renaming session"),
  });

  const createShareLinkMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/payout/sessions/${sessionId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId: selectedGuildId }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Failed to create share link");
      }

      const payload = (await res.json()) as {
        shareUrl: string;
        expiresAt: string;
      };
      return { ...payload, sessionId };
    },
    onSuccess: (data) => {
      setSharedLinkBySession((previous) => ({
        ...previous,
        [data.sessionId]: data.shareUrl,
      }));
      setShareExpiresAtBySession((previous) => ({
        ...previous,
        [data.sessionId]: data.expiresAt,
      }));
      setCurrentTimeMs(Date.now());
      toast.success("Shared link generated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revokeShareLinkMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/payout/sessions/${sessionId}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId: selectedGuildId }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Failed to revoke share link");
      }
    },
    onSuccess: (_, sessionId) => {
      setSharedLinkBySession((previous) => {
        const next = { ...previous };
        delete next[sessionId];
        return next;
      });
      setShareExpiresAtBySession((previous) => {
        const next = { ...previous };
        delete next[sessionId];
        return next;
      });
      setCurrentTimeMs(Date.now());
      toast.success("Shared link revoked");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Add entry
  const addEntryMutation = useMutation({
    mutationFn: async (user: DiscordUser) => {
      if (!selectedSessionId) throw new Error("No session selected");
      const res = await fetch("/api/payout/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          guildId: selectedGuildId,
          discordUserId: user.id,
          username: user.username,
          displayName: user.displayName,
        }),
      });
      if (!res.ok) throw new Error("Failed to add entry");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payoutSessionsQueryKey });
      setSearchQuery("");
      toast.success("Player added");
    },
    onError: () => toast.error("Error while adding player"),
  });

  // Update entry with optimistic updates
  const updateEntryMutation = useMutation({
    mutationFn: async (data: {
      entryId: string;
      updates: Partial<PayoutEntry>;
    }) => {
      const res = await fetch("/api/payout/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, guildId: selectedGuildId }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to update entry");
      }
      return res.json();
    },
    onMutate: async (data) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: payoutSessionsQueryKey });

      // Snapshot current data
      const previousSessions = queryClient.getQueryData<PayoutSession[]>(
        payoutSessionsQueryKey,
      );

      // Update cache optimistically
      queryClient.setQueryData(
        payoutSessionsQueryKey,
        (old: PayoutSession[]) => {
          return old.map((session) => {
            if (session.id === selectedSessionId) {
              return {
                ...session,
                entries: session.entries.map((entry) =>
                  entry.id === data.entryId
                    ? { ...entry, ...data.updates }
                    : entry,
                ),
              };
            }
            return session;
          });
        },
      );

      return { previousSessions };
    },
    onError: (error: Error, _, context) => {
      // Revert on error
      if (context?.previousSessions) {
        queryClient.setQueryData(
          payoutSessionsQueryKey,
          context.previousSessions,
        );
      }
      toast.error(`Error: ${error.message}`);
    },
    onSuccess: () => {
      toast.success("Update successful");
    },
  });

  // Toggle paid uses a dedicated mutation so counter pending state stays independent
  const togglePaidMutation = useMutation({
    mutationFn: async (data: { entryId: string; isPaid: boolean }) => {
      const res = await fetch("/api/payout/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: data.entryId,
          guildId: selectedGuildId,
          updates: { isPaid: data.isPaid },
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to update entry");
      }
      return res.json();
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: payoutSessionsQueryKey });
      const previousSessions = queryClient.getQueryData<PayoutSession[]>(
        payoutSessionsQueryKey,
      );
      queryClient.setQueryData(payoutSessionsQueryKey, (old: PayoutSession[]) =>
        old.map((session) => ({
          ...session,
          entries: session.entries.map((entry) =>
            entry.id === data.entryId
              ? { ...entry, isPaid: data.isPaid }
              : entry,
          ),
        })),
      );
      return { previousSessions };
    },
    onError: (error: Error, _, context) => {
      if (context?.previousSessions) {
        queryClient.setQueryData(
          payoutSessionsQueryKey,
          context.previousSessions,
        );
      }
      toast.error(`Error: ${error.message}`);
    },
  });

  useEffect(() => {
    updateEntryMutateRef.current = updateEntryMutation.mutate;
  }, [updateEntryMutation.mutate]);

  useEffect(() => {
    const source = new EventSource("/api/live-updates");

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          topic?: string;
        };

        if (payload.type === "update" && payload.topic === "payout") {
          queryClient.invalidateQueries({ queryKey: payoutSessionsQueryKey });
        }
      } catch {
        // Ignore malformed SSE messages.
      }
    };

    return () => {
      source.close();
    };
  }, [queryClient, payoutSessionsQueryKey]);

  // Delete entry with optimistic updates
  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await fetch("/api/payout/entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, guildId: selectedGuildId }),
      });
      if (!res.ok) throw new Error("Failed to delete entry");
      return res.json();
    },
    onMutate: async (entryId) => {
      await queryClient.cancelQueries({ queryKey: payoutSessionsQueryKey });
      const previousSessions = queryClient.getQueryData<PayoutSession[]>(
        payoutSessionsQueryKey,
      );

      queryClient.setQueryData(
        payoutSessionsQueryKey,
        (old: PayoutSession[]) => {
          return old.map((session) => ({
            ...session,
            entries: session.entries.filter((e) => e.id !== entryId),
          }));
        },
      );

      return { previousSessions };
    },
    onError: (error: Error, _, context) => {
      if (context?.previousSessions) {
        queryClient.setQueryData(
          payoutSessionsQueryKey,
          context.previousSessions,
        );
      }
      toast.error(`Error: ${error.message}`);
    },
    onSuccess: () => toast.success("Player removed"),
  });

  // Import roster
  const importRosterMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSessionId) throw new Error("No session selected");
      const res = await fetch("/api/payout/import-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          guildId: selectedGuildId,
        }),
      });
      if (!res.ok) throw new Error("Failed to import roster");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: payoutSessionsQueryKey });
      toast.success(`${data.imported} players imported`);
    },
    onError: () => toast.error("Error while importing"),
  });

  // Import all Discord members with configured Zoo role
  const importZooRoleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSessionId) throw new Error("No session selected");
      const res = await fetch("/api/payout/import-zoo-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          guildId: selectedGuildId,
        }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Failed to import Zoo members");
      }

      return res.json() as Promise<{ imported: number; matched: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: payoutSessionsQueryKey });
      toast.success(
        `${data.imported} player(s) imported from Zoo role (${data.matched} matched).`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Get selected session details
  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  // Sync gold pool input with selected session

  useEffect(() => {
    if (selectedSession) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedGoldPoolInput(String(selectedSession.goldPool));
    }
  }, [selectedSession]);

  // Reset pagination when session changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPlayersPage(1);
  }, [selectedSessionId]);

  // Initialize share link maps from sessions data on load/refresh
  useEffect(() => {
    const linkMap: Record<string, string> = {};
    const expiresMap: Record<string, string> = {};
    for (const session of sessions) {
      const share = session.shares?.[0];
      if (share?.shareUrl) {
        linkMap[session.id] = share.shareUrl;
        expiresMap[session.id] = new Date(
          new Date(share.updatedAt).getTime() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString();
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSharedLinkBySession(linkMap);
    setShareExpiresAtBySession(expiresMap);
  }, [sessions]);

  // Calculate totals
  const calculations = useMemo(() => {
    if (!selectedSession || !guildConfig) return null;

    const multipliers = {
      wars: guildConfig.warsCount || 1,
      races: guildConfig.racesCount || 1,
      reviews: guildConfig.reviewsCount || 1,
      bonus: guildConfig.bonusCount || 1,
      invasions: guildConfig.invasionsCount || 1,
      vods: guildConfig.vodsCount || 1,
    };

    const entriesWithPoints = selectedSession.entries.map((entry) => ({
      ...entry,
      points:
        entry.wars * multipliers.wars +
        entry.races * multipliers.races +
        entry.reviews * multipliers.reviews +
        entry.bonus * multipliers.bonus +
        entry.invasions * multipliers.invasions +
        entry.vods * multipliers.vods,
    }));

    const totalPoints = entriesWithPoints.reduce((sum, e) => sum + e.points, 0);
    const goldPerPoint =
      totalPoints > 0 ? selectedSession.goldPool / totalPoints : 0;

    return {
      entries: entriesWithPoints,
      totalPoints,
      goldPerPoint,
      multipliers,
    };
  }, [selectedSession, guildConfig]);

  // Filter entries by search query
  const filteredEntries = useMemo(() => {
    if (!calculations) return [];
    if (!playerSearchQuery.trim()) return calculations.entries;

    const query = playerSearchQuery.toLowerCase();
    return calculations.entries.filter((entry) => {
      const playerName = (entry.displayName || entry.username).toLowerCase();
      return playerName.includes(query);
    });
  }, [calculations, playerSearchQuery]);

  const totalFilteredPlayers = filteredEntries.length;
  const totalPlayersPages = Math.max(
    1,
    Math.ceil(totalFilteredPlayers / PLAYERS_PER_PAGE),
  );

  const paginatedEntries = useMemo(() => {
    const start = (currentPlayersPage - 1) * PLAYERS_PER_PAGE;
    const end = start + PLAYERS_PER_PAGE;
    return filteredEntries.slice(start, end);
  }, [filteredEntries, currentPlayersPage]);

  if (loadingSessions) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 pb-6 pt-24 text-slate-100">
        <div className="mx-auto max-w-7xl">
          <LoadingIndicator />
        </div>
      </div>
    );
  }

  const selectedSharedLink = selectedSessionId
    ? sharedLinkBySession[selectedSessionId] || ""
    : "";
  const selectedShareExpiresAt = selectedSessionId
    ? shareExpiresAtBySession[selectedSessionId] || ""
    : "";

  const getShareLinkStatus = (sessionId: string) => {
    const expiresAt = shareExpiresAtBySession[sessionId];
    if (!expiresAt) {
      return { hasLink: false, expired: false };
    }

    return {
      hasLink: true,
      expired:
        currentTimeMs > 0 && new Date(expiresAt).getTime() <= currentTimeMs,
    };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <h1 className="text-3xl font-bold mb-6">Payout Distribution</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions List */}
        <div className="lg:col-span-1 space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-4">Sessions</h2>

            {/* Create New Session */}
            <div className="space-y-2 mb-4 p-4 bg-slate-900 rounded border border-slate-700">
              <LoadingButton
                onClick={() => createSessionMutation.mutate()}
                isLoading={createSessionMutation.isPending}
                loadingText="Creating..."
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:cursor-not-allowed"
              >
                <FontAwesomeIcon icon={faPlus} /> New session
              </LoadingButton>
            </div>

            {/* Sessions List */}
            <div className="space-y-2">
              {sessions.map((session) => {
                const shareStatus = getShareLinkStatus(session.id);

                return (
                  <div key={session.id} className="flex gap-2 items-stretch">
                    {renamingSessionId === session.id ? (
                      /* Inline rename editor */
                      <div className="flex flex-1 gap-1 px-3 py-2 bg-slate-800 border border-blue-500 rounded items-center">
                        <input
                          autoFocus
                          value={renameInput}
                          onChange={(e) => setRenameInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              renameSessionMutation.mutate({
                                sessionId: session.id,
                                name: renameInput,
                              });
                            if (e.key === "Escape") setRenamingSessionId(null);
                          }}
                          className="flex-1 bg-transparent text-slate-100 text-sm outline-none placeholder-slate-500"
                          placeholder="Nom de la session..."
                        />
                        <LoadingButton
                          onClick={() =>
                            renameSessionMutation.mutate({
                              sessionId: session.id,
                              name: renameInput,
                            })
                          }
                          isLoading={renameSessionMutation.isPending}
                          className="px-2 py-1 rounded text-green-400 hover:bg-slate-700"
                          title="Confirmer"
                        >
                          <FontAwesomeIcon icon={faCheck} />
                        </LoadingButton>
                        <button
                          type="button"
                          onClick={() => setRenamingSessionId(null)}
                          className="px-2 py-1 rounded text-slate-400 hover:bg-slate-700"
                          title="Annuler"
                        >
                          <FontAwesomeIcon icon={faXmark} />
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Session card button */}
                        <button
                          onClick={() => setSelectedSessionId(session.id)}
                          className={`flex-1 text-left px-4 py-3 rounded border transition-colors ${
                            selectedSessionId === session.id
                              ? "bg-blue-700 border-blue-500"
                              : "bg-slate-800 border-slate-700 hover:bg-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 text-sm font-mono flex-wrap">
                            <span>
                              {new Date(session.createdAt).toLocaleDateString(
                                "en-US",
                              )}
                            </span>
                            {session.name && (
                              <span className="font-sans font-semibold text-slate-200 truncate max-w-[120px]">
                                {session.name}
                              </span>
                            )}
                            {session.isLocked && (
                              <FontAwesomeIcon
                                icon={faLock}
                                className="text-yellow-400 text-xs"
                              />
                            )}
                            {shareStatus.hasLink &&
                              (shareStatus.expired ? (
                                <span className="rounded border border-red-500/60 bg-red-900/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300">
                                  Expired
                                </span>
                              ) : (
                                <span className="rounded border border-emerald-500/60 bg-emerald-900/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                                  Active
                                </span>
                              ))}
                          </div>
                          <div className="text-lg font-semibold">
                            {session.goldPool.toFixed(0)}
                          </div>
                          <div className="text-xs text-slate-400">
                            {session.entries.length} players
                          </div>
                        </button>

                        {/* Lock / unlock button — toujours visible */}
                        <LoadingButton
                          onClick={() =>
                            toggleLockMutation.mutate({
                              sessionId: session.id,
                              isLocked: !session.isLocked,
                            })
                          }
                          isLoading={toggleLockMutation.isPending}
                          disabled={
                            session.isLocked &&
                            session.lockedByUserId !== currentUserId
                          }
                          className={`px-3 rounded ${
                            session.isLocked
                              ? "bg-yellow-700 hover:bg-yellow-600 text-yellow-100"
                              : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                          }`}
                          title={session.isLocked ? "Unlock" : "Lock"}
                        >
                          <FontAwesomeIcon
                            icon={session.isLocked ? faLock : faLockOpen}
                          />
                        </LoadingButton>

                        {/* Rename button visible for selected session */}
                        {selectedSessionId === session.id && (
                          <button
                            type="button"
                            onClick={() => {
                              setRenameInput(session.name ?? "");
                              setRenamingSessionId(session.id);
                            }}
                            className="px-3 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
                            title="Rename session"
                          >
                            <FontAwesomeIcon icon={faPencil} />
                          </button>
                        )}

                        {/* Delete button visible only if selected and unlocked */}
                        {selectedSessionId === session.id &&
                          !session.isLocked && (
                            <LoadingButton
                              onClick={() => setDeleteSessionModalOpen(true)}
                              isLoading={deleteSessionMutation.isPending}
                              className="px-3 rounded bg-red-700 hover:bg-red-800 flex items-center"
                              title="Delete session"
                              aria-label="Delete session"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </LoadingButton>
                          )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Session Detail */}
        {selectedSession && calculations ? (
          <div key={selectedSessionId} className="lg:col-span-2 space-y-6">
            {/* Gold Pool Editor */}
            <div className="p-4 bg-slate-900 rounded border border-slate-700">
              <h3 className="font-semibold mb-3">Settings</h3>
              <label className="block text-sm mb-2">Gold to distribute:</label>
              <div className="mb-4 flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={selectedGoldPoolInput}
                  onChange={(e) => setSelectedGoldPoolInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100"
                />
                <LoadingButton
                  type="button"
                  onClick={() => {
                    if (!selectedSessionId) return;
                    updateSessionMutation.mutate({
                      sessionId: selectedSessionId,
                      updates: {
                        goldPool: Math.max(
                          0,
                          Number.parseFloat(selectedGoldPoolInput) || 0,
                        ),
                      },
                    });
                  }}
                  isLoading={updateSessionMutation.isPending}
                  className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700"
                  title="Save payout"
                  aria-label="Save payout"
                >
                  <FontAwesomeIcon icon={faCheck} />
                </LoadingButton>
              </div>

              <label className="block text-sm mb-2">Shared session link:</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <LoadingButton
                  type="button"
                  onClick={() => {
                    if (!selectedSessionId) return;
                    createShareLinkMutation.mutate(selectedSessionId);
                  }}
                  isLoading={createShareLinkMutation.isPending}
                  className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700"
                >
                  <FontAwesomeIcon icon={faShareNodes} /> Create link
                </LoadingButton>

                <div className="flex flex-1 gap-2">
                  <input
                    type="text"
                    value={selectedSharedLink}
                    readOnly
                    placeholder="Generate a link to share this session"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200"
                  />
                  <button
                    type="button"
                    disabled={!selectedSharedLink}
                    onClick={() => {
                      if (!selectedSharedLink) return;
                      void navigator.clipboard.writeText(selectedSharedLink);
                      toast.success("Link copied");
                    }}
                    className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Copy link"
                  >
                    <FontAwesomeIcon icon={faCopy} />
                  </button>
                  <LoadingButton
                    type="button"
                    disabled={!selectedSessionId}
                    onClick={() => {
                      if (!selectedSessionId) return;
                      revokeShareLinkMutation.mutate(selectedSessionId);
                    }}
                    isLoading={revokeShareLinkMutation.isPending}
                    className="px-3 py-2 rounded bg-red-700 hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Revoke link"
                  >
                    <FontAwesomeIcon icon={faLinkSlash} />
                  </LoadingButton>
                </div>
              </div>
              {selectedShareExpiresAt ? (
                <p className="mt-2 text-xs text-slate-400">
                  This link expires on{" "}
                  {new Date(selectedShareExpiresAt).toLocaleDateString("en-US")}
                </p>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Links expire after 30 days.
                </p>
              )}
            </div>

            {/* Add Players */}
            <div className="p-4 bg-slate-900 rounded border border-slate-700">
              <h3 className="font-semibold mb-3">Add players</h3>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <LoadingButton
                    onClick={() => importRosterMutation.mutate()}
                    isLoading={importRosterMutation.isPending}
                    loadingText="Importing..."
                    className="w-full px-3 py-1 bg-green-700 hover:bg-green-800 rounded text-xs"
                  >
                    <FontAwesomeIcon icon={faDownload} /> Import from roster
                  </LoadingButton>

                  <LoadingButton
                    onClick={() => importZooRoleMutation.mutate()}
                    isLoading={importZooRoleMutation.isPending}
                    loadingText="Importing..."
                    className="w-full px-3 py-1 bg-blue-700 hover:bg-blue-800 rounded text-xs"
                  >
                    <FontAwesomeIcon icon={faUsers} />
                    Import Members with Role membership
                  </LoadingButton>
                </div>

                <input
                  type="text"
                  placeholder="Search by display name or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100"
                />

                {searchQuery.length >= 2 && searchResults.length === 0 && (
                  <div className="text-xs text-slate-400 text-center py-2">
                    No player found
                  </div>
                )}

                {searchQuery.length >= 2 && searchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {searchResults.map((user) => (
                      <LoadingButton
                        key={user.id}
                        onClick={() => addEntryMutation.mutate(user)}
                        isLoading={addEntryMutation.isPending}
                        className="w-full text-left px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold">
                            {user.displayName}
                          </div>
                          <div className="text-xs text-slate-400">
                            {user.username}
                          </div>
                        </div>
                        <FontAwesomeIcon
                          icon={faPlus}
                          className="text-blue-400"
                        />
                      </LoadingButton>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-blue-950 rounded border border-blue-700">
              <div>
                <div className="text-sm text-slate-400">Gold total</div>
                <div className="text-2xl font-bold text-yellow-400">
                  {selectedSession.goldPool.toFixed(0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Total points</div>
                <div className="text-2xl font-bold text-blue-400">
                  {calculations.totalPoints}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Price per point</div>
                <div className="text-2xl font-bold text-emerald-400">
                  {Math.floor(calculations.goldPerPoint)}
                </div>
              </div>
            </div>

            {/* Players List */}
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Search players by name..."
                value={playerSearchQuery}
                onChange={(e) => {
                  setPlayerSearchQuery(e.target.value);
                  setCurrentPlayersPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-3 py-2">Player</th>
                    <th className="text-center px-3 py-2">Wars</th>
                    <th className="text-center px-3 py-2">Races</th>
                    <th className="text-center px-3 py-2">Reviews</th>
                    <th className="text-center px-3 py-2">Bonus</th>
                    <th className="text-center px-3 py-2">Invasions</th>
                    <th className="text-center px-3 py-2">Management</th>
                    <th className="text-center px-3 py-2">Points</th>
                    <th className="text-center px-3 py-2">Gold</th>
                    <th className="text-center px-3 py-2">Paid</th>
                    <th className="text-center px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEntries.map((entry) => {
                    const localEdits = counterEdits[entry.id] || {};
                    const displayEntry = { ...entry, ...localEdits };

                    return (
                      <tr
                        key={entry.id}
                        className={`border-b border-slate-800 hover:bg-slate-900 transition-colors ${
                          entry.isPaid ? "bg-slate-800/40 opacity-60" : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-semibold">
                          {entry.displayName || entry.username}
                        </td>
                        <td className="text-center px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            disabled={entry.isPaid}
                            readOnly={entry.isPaid}
                            value={displayEntry.wars}
                            onChange={(e) =>
                              handleCounterChange(
                                entry.id,
                                "wars",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className={`w-12 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center ${
                              entry.isPaid
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                          />
                        </td>
                        <td className="text-center px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            disabled={entry.isPaid}
                            readOnly={entry.isPaid}
                            value={displayEntry.races}
                            onChange={(e) =>
                              handleCounterChange(
                                entry.id,
                                "races",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className={`w-12 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center ${
                              entry.isPaid
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                          />
                        </td>
                        <td className="text-center px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            disabled={entry.isPaid}
                            readOnly={entry.isPaid}
                            value={displayEntry.reviews}
                            onChange={(e) =>
                              handleCounterChange(
                                entry.id,
                                "reviews",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className={`w-12 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center ${
                              entry.isPaid
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                          />
                        </td>
                        <td className="text-center px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            disabled={entry.isPaid}
                            readOnly={entry.isPaid}
                            value={displayEntry.bonus}
                            onChange={(e) =>
                              handleCounterChange(
                                entry.id,
                                "bonus",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className={`w-12 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center ${
                              entry.isPaid
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                          />
                        </td>
                        <td className="text-center px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            disabled={entry.isPaid}
                            readOnly={entry.isPaid}
                            value={displayEntry.invasions}
                            onChange={(e) =>
                              handleCounterChange(
                                entry.id,
                                "invasions",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className={`w-12 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center ${
                              entry.isPaid
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                          />
                        </td>
                        <td className="text-center px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            disabled={entry.isPaid}
                            readOnly={entry.isPaid}
                            value={displayEntry.vods}
                            onChange={(e) =>
                              handleCounterChange(
                                entry.id,
                                "vods",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className={`w-12 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center ${
                              entry.isPaid
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                          />
                        </td>
                        <td className="text-center px-3 py-2 font-semibold">
                          {displayEntry.wars * calculations.multipliers.wars +
                            displayEntry.races *
                              calculations.multipliers.races +
                            displayEntry.reviews *
                              calculations.multipliers.reviews +
                            displayEntry.bonus *
                              calculations.multipliers.bonus +
                            displayEntry.invasions *
                              calculations.multipliers.invasions +
                            displayEntry.vods * calculations.multipliers.vods}
                        </td>
                        <td className="text-center px-3 py-2 text-yellow-400 font-semibold">
                          {(
                            (displayEntry.wars * calculations.multipliers.wars +
                              displayEntry.races *
                                calculations.multipliers.races +
                              displayEntry.reviews *
                                calculations.multipliers.reviews +
                              displayEntry.bonus *
                                calculations.multipliers.bonus +
                              displayEntry.invasions *
                                calculations.multipliers.invasions +
                              displayEntry.vods *
                                calculations.multipliers.vods) *
                            calculations.goldPerPoint
                          ).toFixed(0)}
                        </td>
                        <td className="text-center px-3 py-2">
                          <LoadingButton
                            onClick={() =>
                              togglePaidMutation.mutate({
                                entryId: entry.id,
                                isPaid: !entry.isPaid,
                              })
                            }
                            isLoading={togglePaidMutation.isPending}
                            className={`px-2 py-1 rounded transition-colors ${
                              entry.isPaid
                                ? "bg-green-700 text-white"
                                : "bg-slate-700 text-slate-400"
                            }`}
                          >
                            <FontAwesomeIcon
                              icon={entry.isPaid ? faCheck : faXmark}
                            />
                          </LoadingButton>
                        </td>
                        <td className="text-center px-3 py-2">
                          <LoadingButton
                            onClick={() => deleteEntryMutation.mutate(entry.id)}
                            isLoading={deleteEntryMutation.isPending}
                            className="px-2 py-1 bg-red-900 hover:bg-red-800 rounded text-red-200"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </LoadingButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {totalPlayersPages > 1 && (
                <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                  <span>
                    Showing{" "}
                    {totalFilteredPlayers === 0
                      ? 0
                      : (currentPlayersPage - 1) * PLAYERS_PER_PAGE + 1}
                    -
                    {Math.min(
                      currentPlayersPage * PLAYERS_PER_PAGE,
                      totalFilteredPlayers,
                    )}{" "}
                    of {totalFilteredPlayers} players
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPlayersPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={currentPlayersPage <= 1}
                      className="rounded bg-slate-800 px-2 py-1 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span>
                      Page {currentPlayersPage}/{totalPlayersPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPlayersPage((prev) =>
                          Math.min(totalPlayersPages, prev + 1),
                        )
                      }
                      disabled={currentPlayersPage >= totalPlayersPages}
                      className="rounded bg-slate-800 px-2 py-1 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center p-6 bg-slate-900 rounded border border-slate-700">
            <div className="text-center text-slate-400">
              {sessions.length === 0
                ? "Create a new session to get started"
                : "Select a session"}
            </div>
          </div>
        )}
      </div>

      {deleteSessionModalOpen && selectedSessionId ? (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="w-80 rounded-lg border border-slate-700 bg-slate-900 p-5">
            <h4 className="text-lg font-semibold text-slate-100">
              Confirm payout deletion
            </h4>
            <p className="mt-2 text-sm text-slate-300">
              This action will permanently delete this payout session and all
              its entries.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteSessionModalOpen(false)}
                className="rounded bg-slate-700 px-3 py-2 text-sm text-slate-100 hover:bg-slate-600"
              >
                Cancel
              </button>
              <LoadingButton
                type="button"
                onClick={() => deleteSessionMutation.mutate(selectedSessionId)}
                isLoading={deleteSessionMutation.isPending}
                loadingText="Deleting..."
                className="rounded bg-red-700 px-3 py-2 text-sm text-white hover:bg-red-800"
              >
                Delete
              </LoadingButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
