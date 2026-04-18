import { PayoutPlayersTable } from "./payout-players-table";
import { PLAYERS_PER_PAGE } from "./payout-types";
import type { PayoutCalculations, PayoutEntry } from "./payout-types";

export function PayoutPlayersSection({
  playerSearchQuery,
  currentPlayersPage,
  totalPlayersPages,
  totalFilteredPlayers,
  paginatedEntries,
  counterEdits,
  calculations,
  isTogglePaidPending,
  isDeletePending,
  onPlayerSearchQueryChange,
  onCounterChange,
  onTogglePaid,
  onDeleteEntry,
  onPreviousPage,
  onNextPage,
}: {
  playerSearchQuery: string;
  currentPlayersPage: number;
  totalPlayersPages: number;
  totalFilteredPlayers: number;
  paginatedEntries: PayoutEntry[];
  counterEdits: Record<string, Partial<PayoutEntry>>;
  calculations: PayoutCalculations;
  isTogglePaidPending: boolean;
  isDeletePending: boolean;
  onPlayerSearchQueryChange: (value: string) => void;
  onCounterChange: (entryId: string, field: string, value: number) => void;
  onTogglePaid: (entryId: string, isPaid: boolean) => void;
  onDeleteEntry: (entryId: string) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}) {
  return (
    <>
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Search players by name..."
          value={playerSearchQuery}
          onChange={(event) => onPlayerSearchQueryChange(event.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto">
        <PayoutPlayersTable
          entries={paginatedEntries}
          counterEdits={counterEdits}
          calculations={calculations}
          isTogglePaidPending={isTogglePaidPending}
          isDeletePending={isDeletePending}
          onCounterChange={onCounterChange}
          onTogglePaid={onTogglePaid}
          onDeleteEntry={onDeleteEntry}
        />

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
                onClick={onPreviousPage}
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
                onClick={onNextPage}
                disabled={currentPlayersPage >= totalPlayersPages}
                className="rounded bg-slate-800 px-2 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
