import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faLock,
  faLockOpen,
  faPencil,
  faPlus,
  faTrash,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { LoadingButton } from "@/components/loading-button";
import type { PayoutSession } from "./payout-types";

type ShareStatus = {
  hasLink: boolean;
  expired: boolean;
};

export function PayoutSessionsSidebar({
  sessions,
  isLoading,
  selectedSessionId,
  renamingSessionId,
  renameInput,
  currentUserId,
  createSessionPending,
  renamePending,
  toggleLockPending,
  deletePending,
  getShareLinkStatus,
  onCreateSession,
  onSelectSession,
  onRenameInputChange,
  onConfirmRename,
  onCancelRename,
  onStartRename,
  onToggleLock,
  onRequestDelete,
}: {
  sessions: PayoutSession[];
  isLoading: boolean;
  selectedSessionId: string | null;
  renamingSessionId: string | null;
  renameInput: string;
  currentUserId: string | null;
  createSessionPending: boolean;
  renamePending: boolean;
  toggleLockPending: boolean;
  deletePending: boolean;
  getShareLinkStatus: (sessionId: string) => ShareStatus;
  onCreateSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onRenameInputChange: (value: string) => void;
  onConfirmRename: (sessionId: string) => void;
  onCancelRename: () => void;
  onStartRename: (session: PayoutSession) => void;
  onToggleLock: (session: PayoutSession) => void;
  onRequestDelete: () => void;
}) {
  return (
    <div className="lg:col-span-1 space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-4">Sessions</h2>

        <div className="space-y-2 mb-4 p-4 bg-slate-900 rounded border border-slate-700">
          {isLoading ? (
            <div className="h-9 w-full animate-pulse rounded bg-slate-700" />
          ) : (
            <LoadingButton
              onClick={onCreateSession}
              isLoading={createSessionPending}
              loadingText="Creating..."
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:cursor-not-allowed"
            >
              <FontAwesomeIcon icon={faPlus} /> New session
            </LoadingButton>
          )}
        </div>

        <div className="space-y-2">
          {isLoading ? (
            <>
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[76px] animate-pulse rounded border border-slate-700 bg-slate-800"
                />
              ))}
            </>
          ) : null}
          {!isLoading && sessions.map((session) => {
            const shareStatus = getShareLinkStatus(session.id);

            return (
              <div key={session.id} className="flex gap-2 items-stretch">
                {renamingSessionId === session.id ? (
                  <div className="flex flex-1 gap-1 px-3 py-2 bg-slate-800 border border-blue-500 rounded items-center">
                    <input
                      autoFocus
                      value={renameInput}
                      onChange={(event) =>
                        onRenameInputChange(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          onConfirmRename(session.id);
                        }
                        if (event.key === "Escape") {
                          onCancelRename();
                        }
                      }}
                      className="flex-1 bg-transparent text-slate-100 text-sm outline-none placeholder-slate-500"
                      placeholder="Session name..."
                    />
                    <LoadingButton
                      onClick={() => onConfirmRename(session.id)}
                      isLoading={renamePending}
                      className="px-2 py-1 rounded text-green-400 hover:bg-slate-700"
                      title="Confirm"
                    >
                      <FontAwesomeIcon icon={faCheck} />
                    </LoadingButton>
                    <button
                      type="button"
                      onClick={onCancelRename}
                      className="px-2 py-1 rounded text-slate-400 hover:bg-slate-700"
                      title="Cancel"
                    >
                      <FontAwesomeIcon icon={faXmark} />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => onSelectSession(session.id)}
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

                    <LoadingButton
                      onClick={() => onToggleLock(session)}
                      isLoading={toggleLockPending}
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

                    {selectedSessionId === session.id && (
                      <button
                        type="button"
                        onClick={() => onStartRename(session)}
                        className="px-3 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
                        title="Rename session"
                      >
                        <FontAwesomeIcon icon={faPencil} />
                      </button>
                    )}

                    {selectedSessionId === session.id && !session.isLocked && (
                      <LoadingButton
                        onClick={onRequestDelete}
                        isLoading={deletePending}
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
  );
}
