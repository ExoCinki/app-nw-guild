import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faXmark } from "@fortawesome/free-solid-svg-icons";
import type {
  PlayerHistory,
  PlayerWarStats,
  RosterIndexSummary,
  ScoreField,
  ScoreboardEntry,
} from "./scoreboard-types";

type ScoreboardRosterSummaryBlockProps = {
  selectedRosterSessionId: string | null;
  rosterGroupedStats: RosterIndexSummary[];
};

export function ScoreboardRosterSummaryBlock({
  selectedRosterSessionId,
  rosterGroupedStats,
}: ScoreboardRosterSummaryBlockProps) {
  if (!selectedRosterSessionId) {
    return null;
  }

  return (
    <div className="mb-4 space-y-4">
      {rosterGroupedStats.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3 text-xs text-slate-400">
          No match between roster players and scoreboard players.
        </div>
      ) : (
        rosterGroupedStats.map((summary) => (
          <div
            key={summary.rosterIndex}
            className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-200">
                Roster {summary.rosterIndex}
              </h3>
              <span className="text-xs text-slate-400">
                {summary.uniquePlayersCount} player(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-left uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Group</th>
                    <th className="px-2 py-2">Players</th>
                    <th className="px-2 py-2">Kills</th>
                    <th className="px-2 py-2">Deaths</th>
                    <th className="px-2 py-2">Assists</th>
                    <th className="px-2 py-2">Damage</th>
                    <th className="px-2 py-2">Healing</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.groups.map((group) => (
                    <tr
                      key={group.groupId}
                      className="border-b border-slate-900"
                    >
                      <td className="px-2 py-2 text-slate-200">
                        G{group.groupNumber}
                        {group.groupName ? ` - ${group.groupName}` : ""}
                      </td>
                      <td className="px-2 py-2 text-slate-400">
                        {group.playersCount}
                      </td>
                      <td className="px-2 py-2 text-slate-300">
                        {group.totals.kills}
                      </td>
                      <td className="px-2 py-2 text-slate-300">
                        {group.totals.deaths}
                      </td>
                      <td className="px-2 py-2 text-slate-300">
                        {group.totals.assists}
                      </td>
                      <td className="px-2 py-2 text-slate-300">
                        {group.totals.damageDealt}
                      </td>
                      <td className="px-2 py-2 text-slate-300">
                        {group.totals.healingDone}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-900/40 font-semibold text-slate-100">
                    <td className="px-2 py-2">Global roster</td>
                    <td className="px-2 py-2 text-slate-300">
                      {summary.uniquePlayersCount}
                    </td>
                    <td className="px-2 py-2">{summary.global.kills}</td>
                    <td className="px-2 py-2">{summary.global.deaths}</td>
                    <td className="px-2 py-2">{summary.global.assists}</td>
                    <td className="px-2 py-2">{summary.global.damageDealt}</td>
                    <td className="px-2 py-2">{summary.global.healingDone}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

type ScoreboardSessionEntriesTableProps = {
  entries: ScoreboardEntry[];
  onOpenPlayerStats: (playerName: string) => void;
  onRenamePlayer: (
    entryId: string,
    currentName: string,
    nextName: string,
  ) => void;
  onSubmitStat: (
    entryId: string,
    field: ScoreField,
    rawValue: string,
    currentValue: number,
  ) => void;
  onDeleteEntry: (entryId: string) => void;
};

export function ScoreboardSessionEntriesTable({
  entries,
  onOpenPlayerStats,
  onRenamePlayer,
  onSubmitStat,
  onDeleteEntry,
}: ScoreboardSessionEntriesTableProps) {
  return (
    <table className="w-full min-w-[900px] text-sm">
      <thead>
        <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400">
          <th className="px-2 py-2">Player</th>
          <th className="px-2 py-2">Kills</th>
          <th className="px-2 py-2">Deaths</th>
          <th className="px-2 py-2">Assists</th>
          <th className="px-2 py-2">Damage</th>
          <th className="px-2 py-2">Healing</th>
          <th className="px-2 py-2">Actions</th>
        </tr>
      </thead>
      <tbody>
        {entries.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-2 py-6 text-center text-slate-500">
              No player in this scoreboard.
            </td>
          </tr>
        ) : (
          entries.map((entry) => (
            <tr key={entry.id} className="border-b border-slate-800/70">
              <td className="px-2 py-2">
                <button
                  type="button"
                  onClick={() => onOpenPlayerStats(entry.playerName)}
                  className="mb-1 block text-left text-sm font-semibold text-sky-300 transition hover:text-sky-200"
                >
                  {entry.playerName}
                </button>
                <input
                  type="text"
                  defaultValue={entry.playerName}
                  onBlur={(event) =>
                    onRenamePlayer(
                      entry.id,
                      entry.playerName,
                      event.target.value.trim(),
                    )
                  }
                  className="w-full rounded border border-slate-700 bg-slate-800/50 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-slate-500"
                />
              </td>
              <td className="px-2 py-2">
                <input
                  type="number"
                  min={0}
                  defaultValue={entry.kills}
                  onBlur={(event) =>
                    onSubmitStat(
                      entry.id,
                      "kills",
                      event.target.value,
                      entry.kills,
                    )
                  }
                  className="w-24 rounded border border-slate-700 bg-slate-800/50 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-slate-500"
                />
              </td>
              <td className="px-2 py-2">
                <input
                  type="number"
                  min={0}
                  defaultValue={entry.deaths}
                  onBlur={(event) =>
                    onSubmitStat(
                      entry.id,
                      "deaths",
                      event.target.value,
                      entry.deaths,
                    )
                  }
                  className="w-24 rounded border border-slate-700 bg-slate-800/50 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-slate-500"
                />
              </td>
              <td className="px-2 py-2">
                <input
                  type="number"
                  min={0}
                  defaultValue={entry.assists}
                  onBlur={(event) =>
                    onSubmitStat(
                      entry.id,
                      "assists",
                      event.target.value,
                      entry.assists,
                    )
                  }
                  className="w-24 rounded border border-slate-700 bg-slate-800/50 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-slate-500"
                />
              </td>
              <td className="px-2 py-2">
                <input
                  type="number"
                  min={0}
                  defaultValue={entry.damageDealt}
                  onBlur={(event) =>
                    onSubmitStat(
                      entry.id,
                      "damageDealt",
                      event.target.value,
                      entry.damageDealt,
                    )
                  }
                  className="w-32 rounded border border-slate-700 bg-slate-800/50 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-slate-500"
                />
              </td>
              <td className="px-2 py-2">
                <input
                  type="number"
                  min={0}
                  defaultValue={entry.healingDone}
                  onBlur={(event) =>
                    onSubmitStat(
                      entry.id,
                      "healingDone",
                      event.target.value,
                      entry.healingDone,
                    )
                  }
                  className="w-32 rounded border border-slate-700 bg-slate-800/50 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-slate-500"
                />
              </td>
              <td className="px-2 py-2">
                <button
                  type="button"
                  onClick={() => onDeleteEntry(entry.id)}
                  className="rounded border border-red-600/40 bg-red-500/10 px-2 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
                >
                  <FontAwesomeIcon icon={faTrash} className="mr-1 h-3 w-3" />
                  Remove
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

type ScoreboardHistoryTableProps = {
  players: PlayerHistory[];
  onOpenPlayerStats: (playerName: string) => void;
};

export function ScoreboardHistoryTable({
  players,
  onOpenPlayerStats,
}: ScoreboardHistoryTableProps) {
  return (
    <table className="w-full min-w-[960px] text-sm">
      <thead>
        <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400">
          <th className="px-2 py-2">Player</th>
          <th className="px-2 py-2">Sessions</th>
          <th className="px-2 py-2">Kills</th>
          <th className="px-2 py-2">Deaths</th>
          <th className="px-2 py-2">Assists</th>
          <th className="px-2 py-2">Damage</th>
          <th className="px-2 py-2">Healing</th>
          <th className="px-2 py-2">Last updated</th>
        </tr>
      </thead>
      <tbody>
        {players.length === 0 ? (
          <tr>
            <td colSpan={8} className="px-2 py-6 text-center text-slate-500">
              No result in history.
            </td>
          </tr>
        ) : (
          players.map((player) => (
            <tr
              key={player.playerName}
              className="border-b border-slate-800/70"
            >
              <td className="px-2 py-2 font-medium text-slate-100">
                <button
                  type="button"
                  onClick={() => onOpenPlayerStats(player.playerName)}
                  className="text-left text-sky-300 transition hover:text-sky-200"
                >
                  {player.playerName}
                </button>
              </td>
              <td className="px-2 py-2 text-slate-300">
                {player.sessionsPlayed}
              </td>
              <td className="px-2 py-2 text-slate-300">{player.kills}</td>
              <td className="px-2 py-2 text-slate-300">{player.deaths}</td>
              <td className="px-2 py-2 text-slate-300">{player.assists}</td>
              <td className="px-2 py-2 text-slate-300">{player.damageDealt}</td>
              <td className="px-2 py-2 text-slate-300">{player.healingDone}</td>
              <td className="px-2 py-2 text-slate-400">
                {new Date(player.updatedAt).toLocaleString("en-US")}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

type ScoreboardPlayerGlobalStats = {
  warsParticipated: number;
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  healingDone: number;
};

type ScoreboardPlayerStatsModalProps = {
  isOpen: boolean;
  playerName: string;
  playerStatsView: "global" | "wars";
  onClose: () => void;
  onChangeView: (view: "global" | "wars") => void;
  selectedPlayerGlobalStats: ScoreboardPlayerGlobalStats;
  selectedPlayerWarStats: PlayerWarStats[];
};

export function ScoreboardPlayerStatsModal({
  isOpen,
  playerName,
  playerStatsView,
  onClose,
  onChangeView,
  selectedPlayerGlobalStats,
  selectedPlayerWarStats,
}: ScoreboardPlayerStatsModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl shadow-black/60">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{playerName}</h2>
            <p className="text-sm text-slate-400">Global stats and war details</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-600"
          >
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeView("global")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              playerStatsView === "global"
                ? "bg-emerald-500/20 text-emerald-300"
                : "border border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600"
            }`}
          >
            Global
          </button>
          <button
            type="button"
            onClick={() => onChangeView("wars")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              playerStatsView === "wars"
                ? "bg-sky-500/20 text-sky-300"
                : "border border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600"
            }`}
          >
            Wars
          </button>
        </div>

        {playerStatsView === "global" ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Wars participated
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-100">
                {selectedPlayerGlobalStats.warsParticipated}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Kills</p>
              <p className="mt-1 text-xl font-semibold text-slate-100">
                {selectedPlayerGlobalStats.kills}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Deaths</p>
              <p className="mt-1 text-xl font-semibold text-slate-100">
                {selectedPlayerGlobalStats.deaths}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Assists</p>
              <p className="mt-1 text-xl font-semibold text-slate-100">
                {selectedPlayerGlobalStats.assists}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Damage</p>
              <p className="mt-1 text-xl font-semibold text-slate-100">
                {selectedPlayerGlobalStats.damageDealt}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Healing</p>
              <p className="mt-1 text-xl font-semibold text-slate-100">
                {selectedPlayerGlobalStats.healingDone}
              </p>
            </div>
          </div>
        ) : (
          <div className="max-h-[55vh] overflow-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-2 py-2">War</th>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Kills</th>
                  <th className="px-2 py-2">Deaths</th>
                  <th className="px-2 py-2">Assists</th>
                  <th className="px-2 py-2">Damage</th>
                  <th className="px-2 py-2">Healing</th>
                </tr>
              </thead>
              <tbody>
                {selectedPlayerWarStats.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-2 py-6 text-center text-slate-500">
                      No participation found.
                    </td>
                  </tr>
                ) : (
                  selectedPlayerWarStats.map((war) => (
                    <tr key={war.sessionId} className="border-b border-slate-800/70">
                      <td className="px-2 py-2 text-slate-100">{war.sessionName}</td>
                      <td className="px-2 py-2 text-slate-400">
                        {new Date(war.sessionCreatedAt).toLocaleString("en-US")}
                      </td>
                      <td className="px-2 py-2 text-slate-300">{war.sessionStatus}</td>
                      <td className="px-2 py-2 text-slate-300">{war.kills}</td>
                      <td className="px-2 py-2 text-slate-300">{war.deaths}</td>
                      <td className="px-2 py-2 text-slate-300">{war.assists}</td>
                      <td className="px-2 py-2 text-slate-300">{war.damageDealt}</td>
                      <td className="px-2 py-2 text-slate-300">{war.healingDone}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
