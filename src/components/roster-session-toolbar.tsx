import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArchive,
  faLock,
  faLockOpen,
  faPencil,
  faShareNodes,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import type { RosterSessionSummary } from "@/components/roster-card.types";

const ACTION_BUTTON_BASE =
  "rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40";

const ACTION_BUTTON_VARIANTS = {
  neutral: "border-slate-600/60 bg-slate-800 text-slate-300 hover:bg-slate-700",
  success:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-500/60 hover:bg-emerald-500/20",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-400 hover:border-sky-500/60 hover:bg-sky-500/20",
  primary:
    "border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:border-indigo-500/60 hover:bg-indigo-500/20",
  warning:
    "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:border-amber-500/60 hover:bg-amber-500/20",
  danger:
    "border-red-500/30 bg-red-500/10 text-red-400 hover:border-red-500/60 hover:bg-red-500/20",
  dangerAlt:
    "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:border-rose-500/60 hover:bg-rose-500/20",
} as const;

type ActionButtonVariant = keyof typeof ACTION_BUTTON_VARIANTS;

function actionButtonClass(variant: ActionButtonVariant, withIcon = false) {
  const iconClass = withIcon ? " flex items-center gap-1.5" : "";
  return `${ACTION_BUTTON_BASE}${iconClass} ${ACTION_BUTTON_VARIANTS[variant]}`;
}

type RosterSessionToolbarProps = {
  activeSessionId: string | null;
  sessions: RosterSessionSummary[];
  activeSession: RosterSessionSummary | null;
  activeShareUrl: string | null;
  isCreatingSession: boolean;
  isRenamingSession: boolean;
  isLockingSession: boolean;
  isSharingSession: boolean;
  isDisablingShare: boolean;
  isArchiving: boolean;
  isClearing: boolean;
  isDeletingSession: boolean;
  onSelectSession: (sessionId: string | null) => void;
  onCreateSession: () => void;
  onRenameSession: () => void;
  onToggleLockSession: () => void;
  onShareSession: () => void;
  onDisableShare: () => void;
  onOpenArchiveConfirm: () => void;
  onOpenClearConfirm: () => void;
  onDeleteSession: () => void;
};

export function RosterSessionToolbar({
  activeSessionId,
  sessions,
  activeSession,
  activeShareUrl,
  isCreatingSession,
  isRenamingSession,
  isLockingSession,
  isSharingSession,
  isDisablingShare,
  isArchiving,
  isClearing,
  isDeletingSession,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onToggleLockSession,
  onShareSession,
  onDisableShare,
  onOpenArchiveConfirm,
  onOpenClearConfirm,
  onDeleteSession,
}: RosterSessionToolbarProps) {
  return (
    <div className="flex w-full max-w-[980px] flex-col gap-2 xl:items-end">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-950/40 p-2">
        <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Session
        </span>
        <select
          value={activeSessionId ?? ""}
          onChange={(event) => onSelectSession(event.target.value || null)}
          className="min-w-[220px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100"
        >
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name ?? "Untitled session"}
              {session.isLocked ? " (Locked)" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onCreateSession}
          disabled={isCreatingSession}
          className={actionButtonClass("success")}
          title="Create roster session"
        >
          New session
        </button>
        <button
          type="button"
          onClick={onRenameSession}
          disabled={!activeSessionId || isRenamingSession}
          className={actionButtonClass("neutral", true)}
          title="Rename session"
        >
          <FontAwesomeIcon icon={faPencil} className="h-3 w-3" />
          Rename
        </button>
        <button
          type="button"
          onClick={onToggleLockSession}
          disabled={!activeSessionId || isLockingSession}
          className={actionButtonClass("neutral", true)}
          title={activeSession?.isLocked ? "Unlock session" : "Lock session"}
        >
          <FontAwesomeIcon
            icon={activeSession?.isLocked ? faLock : faLockOpen}
            className="h-3 w-3"
          />
          {activeSession?.isLocked ? "Locked" : "Open"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-950/40 p-2">
        <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Actions
        </span>
        <button
          type="button"
          onClick={onShareSession}
          disabled={!activeSessionId || isSharingSession}
          className={actionButtonClass("primary", true)}
          title="Generate share link"
        >
          <FontAwesomeIcon icon={faShareNodes} className="h-3 w-3" />
          Share
        </button>
        {activeShareUrl ? (
          <button
            type="button"
            onClick={onDisableShare}
            disabled={isDisablingShare}
            className={actionButtonClass("warning")}
            title="Disable share link"
          >
            Disable share
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpenArchiveConfirm}
          disabled={isArchiving}
          className={actionButtonClass("info", true)}
          title="Archive current roster"
        >
          <FontAwesomeIcon icon={faArchive} className="h-3 w-3" />
          Archive
        </button>
        <button
          type="button"
          onClick={onOpenClearConfirm}
          disabled={isClearing}
          className={actionButtonClass("danger", true)}
          title="Clear roster"
        >
          <FontAwesomeIcon icon={faTrash} className="h-3 w-3" />
          Clear
        </button>
        <button
          type="button"
          onClick={onDeleteSession}
          disabled={!activeSessionId || isDeletingSession}
          className={actionButtonClass("dangerAlt")}
          title="Delete session"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
