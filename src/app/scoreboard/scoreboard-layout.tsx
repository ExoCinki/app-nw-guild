import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClockRotateLeft,
  faPlus,
  faTableList,
} from "@fortawesome/free-solid-svg-icons";
import { LoadingButton } from "@/components/loading-button";
import type { ScoreboardSession, ViewMode } from "./scoreboard-types";

type ScoreboardPageHeaderProps = {
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
};

export function ScoreboardPageHeader({
  viewMode,
  onChangeViewMode,
}: ScoreboardPageHeaderProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/30 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Scoreboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Combat stats entry and player history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeViewMode("sessions")}
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
            onClick={() => onChangeViewMode("history")}
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
            Player history
          </button>
        </div>
      </div>
    </div>
  );
}

type ScoreboardSessionsSidebarProps = {
  sessions: ScoreboardSession[];
  selectedSessionId: string | null;
  isCreatingSession: boolean;
  onCreateSession: () => void;
  onSelectSession: (sessionId: string) => void;
};

export function ScoreboardSessionsSidebar({
  sessions,
  selectedSessionId,
  isCreatingSession,
  onCreateSession,
  onSelectSession,
}: ScoreboardSessionsSidebarProps) {
  return (
    <aside className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl shadow-black/30 backdrop-blur">
      <LoadingButton
        isLoading={isCreatingSession}
        onClick={onCreateSession}
        className="mb-4 w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500"
      >
        <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
        New scoreboard
      </LoadingButton>

      <div className="space-y-2">
        {sessions.length === 0 ? (
          <p className="text-sm text-slate-500">No scoreboard yet.</p>
        ) : (
          sessions.map((session) => {
            const isSelected = session.id === selectedSessionId;

            return (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelectSession(session.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                  isSelected
                    ? "border-sky-500/60 bg-sky-500/10"
                    : "border-slate-700 bg-slate-800/40 hover:border-slate-600"
                }`}
              >
                <p className="truncate text-sm font-semibold text-slate-200">
                  {session.name || "Untitled scoreboard"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(session.createdAt).toLocaleDateString("en-US")}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {session.entries.length} player(s)
                </p>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
