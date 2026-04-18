import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faTrash, faXmark } from "@fortawesome/free-solid-svg-icons";
import { LoadingButton } from "@/components/loading-button";

type PayoutEntry = {
  id: string;
  username: string;
  displayName: string | null;
  wars: number;
  races: number;
  reviews: number;
  bonus: number;
  invasions: number;
  vods: number;
  isPaid: boolean;
};

type PayoutCalculations = {
  goldPerPoint: number;
  multipliers: {
    wars: number;
    races: number;
    reviews: number;
    bonus: number;
    invasions: number;
    vods: number;
  };
};

type PayoutPlayersTableProps = {
  entries: PayoutEntry[];
  counterEdits: Record<string, Partial<PayoutEntry>>;
  calculations: PayoutCalculations;
  isTogglePaidPending: boolean;
  isDeletePending: boolean;
  onCounterChange: (entryId: string, field: string, value: number) => void;
  onTogglePaid: (entryId: string, isPaid: boolean) => void;
  onDeleteEntry: (entryId: string) => void;
};

function computePoints(entry: PayoutEntry, calculations: PayoutCalculations) {
  return (
    entry.wars * calculations.multipliers.wars +
    entry.races * calculations.multipliers.races +
    entry.reviews * calculations.multipliers.reviews +
    entry.bonus * calculations.multipliers.bonus +
    entry.invasions * calculations.multipliers.invasions +
    entry.vods * calculations.multipliers.vods
  );
}

export function PayoutPlayersTable({
  entries,
  counterEdits,
  calculations,
  isTogglePaidPending,
  isDeletePending,
  onCounterChange,
  onTogglePaid,
  onDeleteEntry,
}: PayoutPlayersTableProps) {
  return (
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
        {entries.map((entry) => {
          const localEdits = counterEdits[entry.id] || {};
          const displayEntry = { ...entry, ...localEdits };
          const points = computePoints(displayEntry, calculations);

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
                    onCounterChange(
                      entry.id,
                      "wars",
                      parseInt(e.target.value) || 0,
                    )
                  }
                  className={`w-12 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center ${
                    entry.isPaid ? "opacity-50 cursor-not-allowed" : ""
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
                    onCounterChange(
                      entry.id,
                      "races",
                      parseInt(e.target.value) || 0,
                    )
                  }
                  className={`w-12 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center ${
                    entry.isPaid ? "opacity-50 cursor-not-allowed" : ""
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
                    onCounterChange(
                      entry.id,
                      "reviews",
                      parseInt(e.target.value) || 0,
                    )
                  }
                  className={`w-12 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center ${
                    entry.isPaid ? "opacity-50 cursor-not-allowed" : ""
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
                    onCounterChange(
                      entry.id,
                      "bonus",
                      parseInt(e.target.value) || 0,
                    )
                  }
                  className={`w-12 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center ${
                    entry.isPaid ? "opacity-50 cursor-not-allowed" : ""
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
                    onCounterChange(
                      entry.id,
                      "invasions",
                      parseInt(e.target.value) || 0,
                    )
                  }
                  className={`w-12 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center ${
                    entry.isPaid ? "opacity-50 cursor-not-allowed" : ""
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
                    onCounterChange(
                      entry.id,
                      "vods",
                      parseInt(e.target.value) || 0,
                    )
                  }
                  className={`w-12 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center ${
                    entry.isPaid ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                />
              </td>
              <td className="text-center px-3 py-2 font-semibold">{points}</td>
              <td className="text-center px-3 py-2 text-yellow-400 font-semibold">
                {(points * calculations.goldPerPoint).toFixed(0)}
              </td>
              <td className="text-center px-3 py-2">
                <LoadingButton
                  onClick={() => onTogglePaid(entry.id, !entry.isPaid)}
                  isLoading={isTogglePaidPending}
                  className={`px-2 py-1 rounded transition-colors ${
                    entry.isPaid
                      ? "bg-green-700 text-white"
                      : "bg-slate-700 text-slate-400"
                  }`}
                >
                  <FontAwesomeIcon icon={entry.isPaid ? faCheck : faXmark} />
                </LoadingButton>
              </td>
              <td className="text-center px-3 py-2">
                <LoadingButton
                  onClick={() => onDeleteEntry(entry.id)}
                  isLoading={isDeletePending}
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
  );
}
