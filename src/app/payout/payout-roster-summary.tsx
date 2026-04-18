import type { PayoutRosterIndexSummary } from "./payout-types";

type PayoutRosterSummaryProps = {
  rosterName: string | null;
  summaries: PayoutRosterIndexSummary[];
};

function formatGold(value: number) {
  return Number.isFinite(value) ? value.toFixed(0) : "0";
}

export function PayoutRosterSummary({
  rosterName,
  summaries,
}: PayoutRosterSummaryProps) {
  if (summaries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Roster totals
            </h3>
            <p className="text-xs text-slate-400">
              {rosterName ?? "Selected roster session"}
            </p>
          </div>
        </div>
      </div>

      {summaries.map((summary) => (
        <div
          key={summary.rosterIndex}
          className="rounded-xl border border-slate-800 bg-slate-900/80 p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-slate-100">
              Roster {summary.rosterIndex}
            </h4>
            <div className="text-xs text-slate-400">
              {summary.global.playersCount} slot(s)
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-left uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Group</th>
                  <th className="px-2 py-2">Players</th>
                  <th className="px-2 py-2">Matched</th>
                  <th className="px-2 py-2">Points</th>
                  <th className="px-2 py-2">Gold</th>
                </tr>
              </thead>
              <tbody>
                {summary.groups.map((group) => (
                  <tr key={group.groupId} className="border-b border-slate-900">
                    <td className="px-2 py-2 text-slate-200">
                      G{group.groupNumber}
                      {group.groupName ? ` - ${group.groupName}` : ""}
                    </td>
                    <td className="px-2 py-2 text-slate-400">
                      {group.playersCount}
                    </td>
                    <td className="px-2 py-2 text-slate-300">
                      {group.matchedPlayersCount}
                    </td>
                    <td className="px-2 py-2 text-slate-300">
                      {group.totalPoints}
                    </td>
                    <td className="px-2 py-2 text-yellow-400">
                      {formatGold(group.totalGold)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-950/50 font-semibold text-slate-100">
                  <td className="px-2 py-2">Global roster</td>
                  <td className="px-2 py-2">{summary.global.playersCount}</td>
                  <td className="px-2 py-2">
                    {summary.global.matchedPlayersCount}
                  </td>
                  <td className="px-2 py-2">{summary.global.totalPoints}</td>
                  <td className="px-2 py-2 text-yellow-400">
                    {formatGold(summary.global.totalGold)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
