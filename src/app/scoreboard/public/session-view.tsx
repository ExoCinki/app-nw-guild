"use client";

import type {
  PublicScoreboardEntry,
  PublicScoreboardSession,
  SessionSortKey,
  SortDir,
} from "./types";
import { normalizePlayerNameKey } from "./utils";
import { SortButton } from "./sort-button";
import { PaginationBar } from "./pagination-bar";

type SessionViewProps = {
  sessions: PublicScoreboardSession[];
  effectiveSessionId: string | null;
  selectedSession: PublicScoreboardSession | null;
  sortedFilteredEntries: PublicScoreboardEntry[];
  paginatedEntries: PublicScoreboardEntry[];
  sessionSortKey: SessionSortKey;
  sessionSortDir: SortDir;
  sessionSearch: string;
  effectiveSessionPage: number;
  sessionTotalPages: number;
  onSelectSession: (id: string) => void;
  onSearch: (q: string) => void;
  onSort: (key: SessionSortKey) => void;
  onPagePrev: () => void;
  onPageNext: () => void;
  onOpenPlayerProfile: (playerKey: string) => void;
};

export function SessionView({
  sessions,
  effectiveSessionId,
  selectedSession,
  sortedFilteredEntries,
  paginatedEntries,
  sessionSortKey,
  sessionSortDir,
  sessionSearch,
  effectiveSessionPage,
  sessionTotalPages,
  onSelectSession,
  onSearch,
  onSort,
  onPagePrev,
  onPageNext,
  onOpenPlayerProfile,
}: SessionViewProps) {
  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      {/* Sidebar : liste des sessions */}
      <aside className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl shadow-black/30 backdrop-blur">
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-500">
              No public scoreboard available.
            </p>
          ) : (
            sessions.map((session) => {
              const isSelected = session.id === effectiveSessionId;
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
                    {session.guildName || session.discordGuildId}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(session.createdAt).toLocaleDateString("en-US")} —{" "}
                    {session.status}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Tableau de la session sélectionnée */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/30 backdrop-blur">
        {!selectedSession ? (
          <p className="text-sm text-slate-500">
            Select a session to view details.
          </p>
        ) : (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-100">
                {selectedSession.name || "Scoreboard"}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                {selectedSession.guildName || selectedSession.discordGuildId} —{" "}
                {selectedSession.status}
              </p>
            </div>

            <input
              type="text"
              value={sessionSearch}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search player"
              className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
            />

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-left">
                    {(
                      [
                        ["playerName", "Player"],
                        ["kills", "Kills"],
                        ["deaths", "Deaths"],
                        ["assists", "Assists"],
                        ["damageDealt", "Damage"],
                        ["healingDone", "Healing"],
                      ] as [SessionSortKey, string][]
                    ).map(([key, label]) => (
                      <th key={key} className="px-2 py-2">
                        <SortButton
                          label={label}
                          active={sessionSortKey === key}
                          dir={sessionSortDir}
                          onClick={() => onSort(key)}
                        />
                      </th>
                    ))}
                    <th className="px-2 py-2 text-xs uppercase tracking-wide text-slate-400">
                      Profile
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEntries.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-2 py-6 text-center text-slate-500"
                      >
                        No player found.
                      </td>
                    </tr>
                  ) : (
                    paginatedEntries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b border-slate-800/70"
                      >
                        <td className="px-2 py-2 font-medium text-slate-100">
                          {entry.playerName}
                        </td>
                        <td className="px-2 py-2 text-slate-300">
                          {entry.kills}
                        </td>
                        <td className="px-2 py-2 text-slate-300">
                          {entry.deaths}
                        </td>
                        <td className="px-2 py-2 text-slate-300">
                          {entry.assists}
                        </td>
                        <td className="px-2 py-2 text-slate-300">
                          {entry.damageDealt}
                        </td>
                        <td className="px-2 py-2 text-slate-300">
                          {entry.healingDone}
                        </td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() =>
                              onOpenPlayerProfile(
                                normalizePlayerNameKey(entry.playerName),
                              )
                            }
                            className="rounded border border-sky-600/40 bg-sky-500/10 px-2 py-1 text-xs text-sky-300 transition hover:bg-sky-500/20"
                          >
                            Ouvrir fiche
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <PaginationBar
              currentPage={effectiveSessionPage}
              totalPages={sessionTotalPages}
              totalItems={sortedFilteredEntries.length}
              itemLabel="player(s)"
              onPrev={onPagePrev}
              onNext={onPageNext}
            />
          </>
        )}
      </div>
    </section>
  );
}
