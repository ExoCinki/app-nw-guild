import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryPresets } from "@/lib/query-presets";
import type {
    DiscordUser,
    PayoutEntry,
    PayoutRosterSourcePayload,
    PayoutSession,
} from "./payout-types";

export function usePayoutData({
    selectedSessionId,
    selectedRosterSessionId,
    searchQuery,
    setSharedLinkBySession,
    setShareExpiresAtBySession,
    setCurrentTimeMs,
    setSelectedSessionId,
    setDeleteSessionModalOpen,
    setRenamingSessionId,
    setSearchQuery,
}: {
    selectedSessionId: string | null;
    selectedRosterSessionId: string | null;
    searchQuery: string;
    setSharedLinkBySession: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setShareExpiresAtBySession: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setCurrentTimeMs: React.Dispatch<React.SetStateAction<number>>;
    setSelectedSessionId: (value: string | null) => void;
    setDeleteSessionModalOpen: (value: boolean) => void;
    setRenamingSessionId: (value: string | null) => void;
    setSearchQuery: (value: string) => void;
}) {
    const queryClient = useQueryClient();

    const { data: currentUserAccess, isLoading: loadingCurrentUserAccess } = useQuery({
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

    const { data: rosterSource } = useQuery({
        queryKey: [
            "payout-roster-source",
            selectedGuildId ?? "none",
            selectedRosterSessionId ?? "default",
        ],
        queryFn: async () => {
            if (!selectedGuildId) {
                return {
                    sessions: [],
                    selectedRosterSessionId: null,
                    roster: null,
                } as PayoutRosterSourcePayload;
            }

            const params = new URLSearchParams({ guildId: selectedGuildId });
            if (selectedRosterSessionId) {
                params.set("rosterSessionId", selectedRosterSessionId);
            }

            const res = await fetch(`/api/payout/import-roster?${params.toString()}`);
            if (!res.ok) {
                const payload = (await res.json().catch(() => null)) as {
                    error?: string;
                } | null;
                throw new Error(
                    payload?.error ?? "Failed to load roster sessions for import",
                );
            }

            return res.json() as Promise<PayoutRosterSourcePayload>;
        },
        enabled: Boolean(selectedGuildId),
        ...queryPresets.shortLived,
    });

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
                { method: "DELETE" },
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

    const toggleLockMutation = useMutation({
        mutationFn: async (data: { sessionId: string; isLocked: boolean }) => {
            const res = await fetch(`/api/payout/sessions/${data.sessionId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isLocked: data.isLocked, guildId: selectedGuildId }),
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
                old.map((session) => (session.id === updated.id ? updated : session)),
            );
            toast.success(updated.isLocked ? "Session locked" : "Session unlocked");
        },
        onError: (error: Error) => toast.error(error.message),
    });

    const renameSessionMutation = useMutation({
        mutationFn: async (data: { sessionId: string; name: string }) => {
            const res = await fetch(`/api/payout/sessions/${data.sessionId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: data.name.trim() || null,
                    guildId: selectedGuildId,
                }),
            });
            if (!res.ok) throw new Error("Failed to rename session");
            return res.json() as Promise<PayoutSession>;
        },
        onSuccess: (updated) => {
            queryClient.setQueryData(payoutSessionsQueryKey, (old: PayoutSession[]) =>
                old.map((session) => (session.id === updated.id ? updated : session)),
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
            await queryClient.cancelQueries({ queryKey: payoutSessionsQueryKey });
            const previousSessions = queryClient.getQueryData<PayoutSession[]>(
                payoutSessionsQueryKey,
            );

            queryClient.setQueryData(
                payoutSessionsQueryKey,
                (old: PayoutSession[]) =>
                    old.map((session) => {
                        if (session.id === selectedSessionId) {
                            return {
                                ...session,
                                entries: session.entries.map((entry) =>
                                    entry.id === data.entryId ? { ...entry, ...data.updates } : entry,
                                ),
                            };
                        }
                        return session;
                    }),
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
        onSuccess: () => {
            toast.success("Update successful");
        },
    });

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
                        entry.id === data.entryId ? { ...entry, isPaid: data.isPaid } : entry,
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
                (old: PayoutSession[]) =>
                    old.map((session) => ({
                        ...session,
                        entries: session.entries.filter((entry) => entry.id !== entryId),
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
        onSuccess: () => toast.success("Player removed"),
    });

    const importRosterMutation = useMutation({
        mutationFn: async () => {
            if (!selectedSessionId) throw new Error("No session selected");
            const res = await fetch("/api/payout/import-roster", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId: selectedSessionId,
                    guildId: selectedGuildId,
                    rosterSessionId: selectedRosterSessionId,
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

    return {
        currentUserId,
        selectedGuildId,
        sessions,
        loadingCurrentUserAccess,
        loadingSessions,
        guildConfig,
        rosterSource,
        searchResults,
        payoutSessionsQueryKey,
        createSessionMutation,
        updateSessionMutation,
        deleteSessionMutation,
        toggleLockMutation,
        renameSessionMutation,
        createShareLinkMutation,
        revokeShareLinkMutation,
        addEntryMutation,
        updateEntryMutation,
        togglePaidMutation,
        deleteEntryMutation,
        importRosterMutation,
        importZooRoleMutation,
    };
}
