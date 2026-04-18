import { useCallback } from "react";
import { toast } from "sonner";
import type { DiscordUser, PayoutSession } from "./payout-types";
import type { UsePayoutClientActionsArgs } from "./payout-client-layer-types";

export function usePayoutClientActions({
    selectedSessionId,
    selectedGoldPoolInput,
    selectedSharedLink,
    totalPlayersPages,
    renameInput,
    setRenameInput,
    setRenamingSessionId,
    setDeleteSessionModalOpen,
    setPlayerSearchQuery,
    setCurrentPlayersPage,
    setSelectedSessionId,
    createSessionMutation,
    renameSessionMutation,
    toggleLockMutation,
    updateSessionMutation,
    createShareLinkMutation,
    revokeShareLinkMutation,
    importRosterMutation,
    importZooRoleMutation,
    addEntryMutation,
    togglePaidMutation,
    deleteEntryMutation,
    deleteSessionMutation,
}: UsePayoutClientActionsArgs) {
    const onCreateSession = useCallback(() => {
        createSessionMutation.mutate();
    }, [createSessionMutation]);

    const onSelectSession = useCallback(
        (sessionId: string) => {
            setSelectedSessionId(sessionId);
        },
        [setSelectedSessionId],
    );

    const onConfirmRename = useCallback(
        (sessionId: string) => {
            renameSessionMutation.mutate({ sessionId, name: renameInput });
        },
        [renameInput, renameSessionMutation],
    );

    const onCancelRename = useCallback(() => {
        setRenamingSessionId(null);
    }, [setRenamingSessionId]);

    const onStartRename = useCallback(
        (session: PayoutSession) => {
            setRenameInput(session.name ?? "");
            setRenamingSessionId(session.id);
        },
        [setRenameInput, setRenamingSessionId],
    );

    const onToggleLock = useCallback(
        (session: PayoutSession) => {
            toggleLockMutation.mutate({
                sessionId: session.id,
                isLocked: !session.isLocked,
            });
        },
        [toggleLockMutation],
    );

    const onRequestDelete = useCallback(() => {
        setDeleteSessionModalOpen(true);
    }, [setDeleteSessionModalOpen]);

    const onSaveGoldPool = useCallback(() => {
        if (!selectedSessionId) return;
        updateSessionMutation.mutate({
            sessionId: selectedSessionId,
            updates: {
                goldPool: Math.max(0, Number.parseFloat(selectedGoldPoolInput) || 0),
            },
        });
    }, [selectedGoldPoolInput, selectedSessionId, updateSessionMutation]);

    const onCreateShareLink = useCallback(() => {
        if (!selectedSessionId) return;
        createShareLinkMutation.mutate(selectedSessionId);
    }, [createShareLinkMutation, selectedSessionId]);

    const onCopyShareLink = useCallback(() => {
        if (!selectedSharedLink) return;
        void navigator.clipboard.writeText(selectedSharedLink);
        toast.success("Link copied");
    }, [selectedSharedLink]);

    const onRevokeShareLink = useCallback(() => {
        if (!selectedSessionId) return;
        revokeShareLinkMutation.mutate(selectedSessionId);
    }, [revokeShareLinkMutation, selectedSessionId]);

    const onImportRoster = useCallback(() => {
        importRosterMutation.mutate();
    }, [importRosterMutation]);

    const onImportZooRole = useCallback(() => {
        importZooRoleMutation.mutate();
    }, [importZooRoleMutation]);

    const onAddEntry = useCallback(
        (user: DiscordUser) => {
            addEntryMutation.mutate(user);
        },
        [addEntryMutation],
    );

    const onPlayerSearchQueryChange = useCallback(
        (value: string) => {
            setPlayerSearchQuery(value);
            setCurrentPlayersPage(1);
        },
        [setCurrentPlayersPage, setPlayerSearchQuery],
    );

    const onTogglePaid = useCallback(
        (entryId: string, isPaid: boolean) => {
            togglePaidMutation.mutate({ entryId, isPaid });
        },
        [togglePaidMutation],
    );

    const onDeleteEntry = useCallback(
        (entryId: string) => {
            deleteEntryMutation.mutate(entryId);
        },
        [deleteEntryMutation],
    );

    const onPreviousPage = useCallback(() => {
        setCurrentPlayersPage((previous) => Math.max(1, previous - 1));
    }, [setCurrentPlayersPage]);

    const onNextPage = useCallback(() => {
        setCurrentPlayersPage((previous) =>
            Math.min(totalPlayersPages, previous + 1),
        );
    }, [setCurrentPlayersPage, totalPlayersPages]);

    const onCancelDeleteModal = useCallback(() => {
        setDeleteSessionModalOpen(false);
    }, [setDeleteSessionModalOpen]);

    const onConfirmDeleteSession = useCallback(() => {
        if (!selectedSessionId) return;
        deleteSessionMutation.mutate(selectedSessionId);
    }, [deleteSessionMutation, selectedSessionId]);

    return {
        onCreateSession,
        onSelectSession,
        onConfirmRename,
        onCancelRename,
        onStartRename,
        onToggleLock,
        onRequestDelete,
        onSaveGoldPool,
        onCreateShareLink,
        onCopyShareLink,
        onRevokeShareLink,
        onImportRoster,
        onImportZooRole,
        onAddEntry,
        onPlayerSearchQueryChange,
        onTogglePaid,
        onDeleteEntry,
        onPreviousPage,
        onNextPage,
        onCancelDeleteModal,
        onConfirmDeleteSession,
    };
}