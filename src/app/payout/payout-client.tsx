"use client";

import { PayoutDeleteSessionModal } from "./payout-delete-session-modal";
import { PayoutEmptyState } from "./payout-empty-state";
import { PayoutPlayersSection } from "./payout-players-section";
import { PayoutRosterSummary } from "./payout-roster-summary";
import { PayoutSummaryStats } from "./payout-summary-stats";
import { usePayoutClientActions } from "./use-payout-client-actions";
import { usePayoutClientState } from "./use-payout-client-state";
import { PayoutSessionControls } from "./payout-session-controls";
import { PayoutSessionsSidebar } from "./payout-sessions-sidebar";
import { usePayoutClientSync } from "./use-payout-client-sync";
import { usePayoutCounterEdits } from "./use-payout-counter-edits";
import { usePayoutDerivedData } from "./use-payout-derived-data";
import { usePayoutData } from "./use-payout-data";

export default function PayoutClient() {
  const {
    selectedSessionId,
    setSelectedSessionId,
    selectedGoldPoolInput,
    setSelectedGoldPoolInput,
    deleteSessionModalOpen,
    setDeleteSessionModalOpen,
    renamingSessionId,
    setRenamingSessionId,
    renameInput,
    setRenameInput,
    searchQuery,
    setSearchQuery,
    playerSearchQuery,
    setPlayerSearchQuery,
    currentPlayersPage,
    setCurrentPlayersPage,
    selectedRosterSessionId,
    setSelectedRosterSessionId,
    sharedLinkBySession,
    setSharedLinkBySession,
    shareExpiresAtBySession,
    setShareExpiresAtBySession,
    currentTimeMs,
    setCurrentTimeMs,
  } = usePayoutClientState();

  const {
    currentUserId,
    sessions,
    loadingSessions,
    guildConfig,
    rosterSource,
    searchResults,
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
  } = usePayoutData({
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
  });
  const { counterEdits, handleCounterChange } = usePayoutCounterEdits({
    onCommit: updateEntryMutation.mutate,
  });

  // Get selected session details
  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  const { selectedSharedLink, selectedShareExpiresAt, getShareLinkStatus } =
    usePayoutClientSync({
      selectedSession,
      selectedSessionId,
      sessions,
      rosterSource,
      sharedLinkBySession,
      shareExpiresAtBySession,
      currentTimeMs,
      setSelectedRosterSessionId,
      setSelectedGoldPoolInput,
      setCurrentPlayersPage,
      setSharedLinkBySession,
      setShareExpiresAtBySession,
    });

  const {
    calculations,
    rosterSummaries,
    totalFilteredPlayers,
    totalPlayersPages,
    paginatedEntries,
  } = usePayoutDerivedData({
    selectedSession,
    guildConfig,
    playerSearchQuery,
    currentPlayersPage,
    counterEdits,
    rosterSource,
  });

  const {
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
  } = usePayoutClientActions({
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
  });

  if (loadingSessions) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="mb-6 h-9 w-64 animate-pulse rounded bg-slate-800" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Sidebar skeleton */}
          <div className="space-y-4 lg:col-span-1">
            <div className="h-7 w-24 animate-pulse rounded bg-slate-800" />
            <div className="rounded border border-slate-700 bg-slate-900 p-4">
              <div className="h-9 animate-pulse rounded bg-slate-700" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[76px] animate-pulse rounded border border-slate-700 bg-slate-800"
                />
              ))}
            </div>
          </div>
          {/* Detail skeleton */}
          <div className="space-y-6 lg:col-span-2">
            <div className="space-y-3 rounded border border-slate-700 bg-slate-900 p-4">
              <div className="h-5 w-32 animate-pulse rounded bg-slate-700" />
              <div className="h-10 animate-pulse rounded bg-slate-800" />
              <div className="h-10 animate-pulse rounded bg-slate-800" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded border border-slate-700 bg-slate-900"
                />
              ))}
            </div>
            <div className="space-y-2 rounded border border-slate-700 bg-slate-900 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded bg-slate-800"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <h1 className="text-3xl font-bold mb-6">Payout Distribution</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PayoutSessionsSidebar
          sessions={sessions}
          isLoading={false}
          selectedSessionId={selectedSessionId}
          renamingSessionId={renamingSessionId}
          renameInput={renameInput}
          currentUserId={currentUserId}
          createSessionPending={createSessionMutation.isPending}
          renamePending={renameSessionMutation.isPending}
          toggleLockPending={toggleLockMutation.isPending}
          deletePending={deleteSessionMutation.isPending}
          getShareLinkStatus={getShareLinkStatus}
          onCreateSession={onCreateSession}
          onSelectSession={onSelectSession}
          onRenameInputChange={setRenameInput}
          onConfirmRename={onConfirmRename}
          onCancelRename={onCancelRename}
          onStartRename={onStartRename}
          onToggleLock={onToggleLock}
          onRequestDelete={onRequestDelete}
        />

        {/* Session Detail */}
        {selectedSession && calculations ? (
          <div key={selectedSessionId} className="lg:col-span-2 space-y-6">
            <PayoutSessionControls
              selectedSessionId={selectedSessionId}
              selectedGoldPoolInput={selectedGoldPoolInput}
              selectedSharedLink={selectedSharedLink}
              selectedShareExpiresAt={selectedShareExpiresAt}
              selectedRosterSessionId={selectedRosterSessionId}
              rosterSource={rosterSource}
              searchQuery={searchQuery}
              searchResults={searchResults}
              isUpdateSessionPending={updateSessionMutation.isPending}
              isCreateShareLinkPending={createShareLinkMutation.isPending}
              isRevokeShareLinkPending={revokeShareLinkMutation.isPending}
              isImportRosterPending={importRosterMutation.isPending}
              isImportZooRolePending={importZooRoleMutation.isPending}
              isAddEntryPending={addEntryMutation.isPending}
              onGoldPoolInputChange={setSelectedGoldPoolInput}
              onSaveGoldPool={onSaveGoldPool}
              onCreateShareLink={onCreateShareLink}
              onCopyShareLink={onCopyShareLink}
              onRevokeShareLink={onRevokeShareLink}
              onSelectedRosterSessionChange={setSelectedRosterSessionId}
              onImportRoster={onImportRoster}
              onImportZooRole={onImportZooRole}
              onSearchQueryChange={setSearchQuery}
              onAddEntry={onAddEntry}
            />

            <PayoutSummaryStats
              goldPool={selectedSession.goldPool}
              totalPoints={calculations.totalPoints}
              goldPerPoint={calculations.goldPerPoint}
            />

            <PayoutRosterSummary
              rosterName={rosterSource?.roster?.name ?? null}
              summaries={rosterSummaries}
            />

            <PayoutPlayersSection
              playerSearchQuery={playerSearchQuery}
              currentPlayersPage={currentPlayersPage}
              totalPlayersPages={totalPlayersPages}
              totalFilteredPlayers={totalFilteredPlayers}
              paginatedEntries={paginatedEntries}
              counterEdits={counterEdits}
              calculations={calculations}
              isTogglePaidPending={togglePaidMutation.isPending}
              isDeletePending={deleteEntryMutation.isPending}
              onPlayerSearchQueryChange={onPlayerSearchQueryChange}
              onCounterChange={handleCounterChange}
              onTogglePaid={onTogglePaid}
              onDeleteEntry={onDeleteEntry}
              onPreviousPage={onPreviousPage}
              onNextPage={onNextPage}
            />
          </div>
        ) : (
          <PayoutEmptyState hasSessions={sessions.length > 0} />
        )}
      </div>

      <PayoutDeleteSessionModal
        isOpen={deleteSessionModalOpen && Boolean(selectedSessionId)}
        isPending={deleteSessionMutation.isPending}
        onCancel={onCancelDeleteModal}
        onConfirm={onConfirmDeleteSession}
      />
    </div>
  );
}
