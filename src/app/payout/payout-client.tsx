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
} from "@fortawesome/free-solid-svg-icons";
import { LoadingIndicator } from "@/components/loading-indicator";

interface PayoutSession {
  id: string;
  discordGuildId: string;
  goldPool: number;
  status: string;
  entries: PayoutEntry[];
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

export default function PayoutClient() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [goldPoolInput, setGoldPoolInput] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Local state for counter inputs with debounce
  const [counterEdits, setCounterEdits] = useState<
    Record<string, Partial<PayoutEntry>>
  >({});
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const updateEntryMutateRef = useRef<
    ((data: { entryId: string; updates: Partial<PayoutEntry> }) => void) | null
  >(null);

  const queryClient = useQueryClient();

  // Debounced update function
  const debouncedUpdate = useCallback(
    (entryId: string, updates: Partial<PayoutEntry>) => {
      // Clear existing timer
      if (debounceTimers.current[entryId]) {
        clearTimeout(debounceTimers.current[entryId]);
      }

      // Set new timer that triggers mutation after 300ms of inactivity
      debounceTimers.current[entryId] = setTimeout(() => {
        updateEntryMutateRef.current?.({ entryId, updates });
        // Clear from local edits after sending
        setCounterEdits((prev) => {
          const next = { ...prev };
          delete next[entryId];
          return next;
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
      debouncedUpdate(entryId, { [field]: value } as Partial<PayoutEntry>);
    },
    [debouncedUpdate],
  );

  // Fetch sessions
  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ["payout-sessions"],
    queryFn: async () => {
      const res = await fetch("/api/payout/sessions");
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json() as Promise<PayoutSession[]>;
    },
  });

  // Fetch guild config for multipliers
  const { data: guildConfig } = useQuery({
    queryKey: ["guild-config"],
    queryFn: async () => {
      const res = await fetch("/api/guild-config");
      if (!res.ok) throw new Error("Failed to fetch config");
      return res.json();
    },
  });

  // Search Discord users
  const { data: searchResults = [] } = useQuery({
    queryKey: ["discord-search", searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return [];
      const res = await fetch(
        `/api/discord/users/search?q=${encodeURIComponent(searchQuery)}`,
      );
      if (!res.ok) return [];
      return res.json() as Promise<DiscordUser[]>;
    },
    enabled: searchQuery.length >= 2,
  });

  // Create session
  const createSessionMutation = useMutation({
    mutationFn: async (goldPool: number) => {
      const res = await fetch("/api/payout/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goldPool }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      return res.json();
    },
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ["payout-sessions"] });
      setSelectedSessionId(newSession.id);
      setGoldPoolInput("");
      toast.success("Session created");
    },
    onError: () => toast.error("Error while creating session"),
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
          discordUserId: user.id,
          username: user.username,
          displayName: user.displayName,
        }),
      });
      if (!res.ok) throw new Error("Failed to add entry");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payout-sessions"] });
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
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to update entry");
      }
      return res.json();
    },
    onMutate: async (data) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["payout-sessions"] });

      // Snapshot current data
      const previousSessions = queryClient.getQueryData<PayoutSession[]>([
        "payout-sessions",
      ]);

      // Update cache optimistically
      queryClient.setQueryData(["payout-sessions"], (old: PayoutSession[]) => {
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
      });

      return { previousSessions };
    },
    onError: (error: Error, _, context) => {
      // Revert on error
      if (context?.previousSessions) {
        queryClient.setQueryData(["payout-sessions"], context.previousSessions);
      }
      toast.error(`Error: ${error.message}`);
    },
    onSuccess: () => {
      toast.success("Update successful");
    },
  });

  useEffect(() => {
    updateEntryMutateRef.current = updateEntryMutation.mutate;
  }, [updateEntryMutation.mutate]);

  // Delete entry with optimistic updates
  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await fetch("/api/payout/entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });
      if (!res.ok) throw new Error("Failed to delete entry");
      return res.json();
    },
    onMutate: async (entryId) => {
      await queryClient.cancelQueries({ queryKey: ["payout-sessions"] });
      const previousSessions = queryClient.getQueryData<PayoutSession[]>([
        "payout-sessions",
      ]);

      queryClient.setQueryData(["payout-sessions"], (old: PayoutSession[]) => {
        return old.map((session) => ({
          ...session,
          entries: session.entries.filter((e) => e.id !== entryId),
        }));
      });

      return { previousSessions };
    },
    onError: (error: Error, _, context) => {
      if (context?.previousSessions) {
        queryClient.setQueryData(["payout-sessions"], context.previousSessions);
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
        body: JSON.stringify({ sessionId: selectedSessionId }),
      });
      if (!res.ok) throw new Error("Failed to import roster");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["payout-sessions"] });
      toast.success(`${data.imported} players imported`);
    },
    onError: () => toast.error("Error while importing"),
  });

  // Get selected session details
  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

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

  if (loadingSessions) {
    return <LoadingIndicator />;
  }

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
              <input
                type="number"
                placeholder="Gold to distribute"
                value={goldPoolInput}
                onChange={(e) => setGoldPoolInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100"
              />
              <button
                onClick={() =>
                  createSessionMutation.mutate(parseFloat(goldPoolInput) || 0)
                }
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
              >
                <FontAwesomeIcon icon={faPlus} /> New session
              </button>
            </div>

            {/* Sessions List */}
            <div className="space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                  className={`w-full text-left px-4 py-3 rounded border transition-colors ${
                    selectedSessionId === session.id
                      ? "bg-blue-700 border-blue-500"
                      : "bg-slate-800 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  <div className="text-sm font-mono">
                    {new Date(session.createdAt).toLocaleDateString("en-US")}
                  </div>
                  <div className="text-lg font-semibold">
                    {session.goldPool.toFixed(0)} or
                  </div>
                  <div className="text-xs text-slate-400">
                    {session.entries.length} players
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Session Detail */}
        {selectedSession && calculations ? (
          <div className="lg:col-span-2 space-y-6">
            {/* Gold Pool Editor */}
            <div className="p-4 bg-slate-900 rounded border border-slate-700">
              <h3 className="font-semibold mb-3">Settings</h3>
              <label className="block text-sm mb-2">Gold to distribute:</label>
              <input
                type="number"
                value={selectedSession.goldPool}
                onChange={() => {
                  // Update session gold pool
                }}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 mb-4"
              />
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-slate-800 px-3 py-2 rounded">
                  <div className="text-slate-400">Total points</div>
                  <div className="text-lg font-semibold">
                    {calculations.totalPoints}
                  </div>
                </div>
                <div className="bg-slate-800 px-3 py-2 rounded">
                  <div className="text-slate-400">Gold per point</div>
                  <div className="text-lg font-semibold">
                    {calculations.goldPerPoint.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Add Players */}
            <div className="p-4 bg-slate-900 rounded border border-slate-700">
              <h3 className="font-semibold mb-3">Add players</h3>
              <div className="space-y-2">
                <button
                  onClick={() => importRosterMutation.mutate()}
                  disabled={importRosterMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-3 py-1 bg-green-700 hover:bg-green-800 rounded text-xs disabled:opacity-50"
                >
                  <FontAwesomeIcon icon={faDownload} /> Import from roster
                </button>

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
                      <button
                        key={user.id}
                        onClick={() => addEntryMutation.mutate(user)}
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
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Players List */}
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
                    <th className="text-center px-3 py-2">VODs</th>
                    <th className="text-center px-3 py-2">Points</th>
                    <th className="text-center px-3 py-2">Gold</th>
                    <th className="text-center px-3 py-2">Paid</th>
                    <th className="text-center px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {calculations.entries.map((entry) => {
                    const localEdits = counterEdits[entry.id] || {};
                    const displayEntry = { ...entry, ...localEdits };

                    return (
                      <tr
                        key={entry.id}
                        className="border-b border-slate-800 hover:bg-slate-900"
                      >
                        <td className="px-3 py-2 font-semibold">
                          {entry.displayName || entry.username}
                        </td>
                        <td className="text-center px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            value={displayEntry.wars}
                            onChange={(e) =>
                              handleCounterChange(
                                entry.id,
                                "wars",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className="w-12 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center"
                          />
                        </td>
                        <td className="text-center px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            value={displayEntry.races}
                            onChange={(e) =>
                              handleCounterChange(
                                entry.id,
                                "races",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className="w-12 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center"
                          />
                        </td>
                        <td className="text-center px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            value={displayEntry.reviews}
                            onChange={(e) =>
                              handleCounterChange(
                                entry.id,
                                "reviews",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className="w-12 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center"
                          />
                        </td>
                        <td className="text-center px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            value={displayEntry.bonus}
                            onChange={(e) =>
                              handleCounterChange(
                                entry.id,
                                "bonus",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className="w-12 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center"
                          />
                        </td>
                        <td className="text-center px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            value={displayEntry.invasions}
                            onChange={(e) =>
                              handleCounterChange(
                                entry.id,
                                "invasions",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className="w-12 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center"
                          />
                        </td>
                        <td className="text-center px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            value={displayEntry.vods}
                            onChange={(e) =>
                              handleCounterChange(
                                entry.id,
                                "vods",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className="w-12 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center"
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
                          <button
                            onClick={() =>
                              updateEntryMutation.mutate({
                                entryId: entry.id,
                                updates: {
                                  isPaid: !entry.isPaid,
                                } as Partial<PayoutEntry>,
                              })
                            }
                            className={`px-2 py-1 rounded transition-colors ${
                              entry.isPaid
                                ? "bg-green-700 text-white"
                                : "bg-slate-700 text-slate-400"
                            }`}
                          >
                            <FontAwesomeIcon
                              icon={entry.isPaid ? faCheck : faXmark}
                            />
                          </button>
                        </td>
                        <td className="text-center px-3 py-2">
                          <button
                            onClick={() => deleteEntryMutation.mutate(entry.id)}
                            className="px-2 py-1 bg-red-900 hover:bg-red-800 rounded text-red-200"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-blue-950 rounded border border-blue-700">
              <div>
                <div className="text-sm text-slate-400">Gold total</div>
                <div className="text-2xl font-bold text-yellow-400">
                  {selectedSession.goldPool.toFixed(0)} or
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
                  {calculations.goldPerPoint.toFixed(2)}
                </div>
              </div>
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
    </div>
  );
}
