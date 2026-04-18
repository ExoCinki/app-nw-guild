"use client";

import type {
  FocusedPlayerSession,
  PlayerAggregate,
  PlayerSortKey,
  SortDir,
} from "./types";
import { safeRatio } from "./utils";
import { SortButton } from "./sort-button";
import { PaginationBar } from "./pagination-bar";
import { StatCard } from "./stat-card";

type PlayerViewProps = {
  paginatedPlayers: PlayerAggregate[];
  sortedFilteredPlayersCount: number;
  playerSearch: string;
  playerSortKey: PlayerSortKey;
  playerSortDir: SortDir;
  effectivePlayerPage: number;
  playerTotalPages: number;
  focusedPlayer: PlayerAggregate | null;
  focusedPlayerSessions: FocusedPlayerSession[];
  onSearch: (q: string) => void;
  onSort: (key: PlayerSortKey) => void;
  onPagePrev: () => void;
  onPageNext: () => void;
  onFocusPlayer: (key: string) => void;
  onClosePlayer: () => void;
};

const PLAYER_COLUMNS: [PlayerSortKey, string][] = [
  ["playerName", "Player"],
  ["sessionsPlayed", "Sessions"],
  ["kills", "Kills"],
  ["deaths", "Deaths"],
  ["assists", "Assists"],
  ["kda", "KDA"],
  ["kd", "KD"],
  ["damageDealt", "Damage"],
  ["healingDone", "Healing"],
  ["updatedAt", "Dernière maj"],
];

export function PlayerView({
  paginatedPlayers,
  sortedFilteredPlayersCount,
  playerSearch,
  playerSortKey,
  playerSortDir,
  effectivePlayerPage,
  playerTotalPages,
  focusedPlayer,
  focusedPlayerSessions,
  onSearch,
  onSort,
  onPagePrev,
  onPageNext,
  onFocusPlayer,
  onClosePlayer,
}: PlayerViewProps) {
  const kda = focusedPlayer
    ? safeRatio(
        focusedPlayer.kills + focusedPlayer.assists,
        focusedPlayer.deaths,
      )
    : 0;
  const kd = focusedPlayer
    ? safeRatio(focusedPlayer.kills, focusedPlayer.deaths)
    : 0;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/30 backdrop-blur">
      <input
        type="text"
        value={playerSearch}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search player (name)"
        className="mb-4 w-full max-w-sm rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
      />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1060px] text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left">
              {PLAYER_COLUMNS.map(([key, label]) => (
                <th key={key} className="px-2 py-2">
                  <SortButton
                    label={label}
                    active={playerSortKey === key}
                    dir={playerSortDir}
                    onClick={() => onSort(key)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedPlayers.length === 0 ? (
              <tr>
                <td
                  colSpan={PLAYER_COLUMNS.length}
                  className="px-2 py-6 text-center text-slate-500"
                >
                  No player found.
                </td>
              </tr>
            ) : (
              paginatedPlayers.map((player) => (
                <tr
                  key={player.key}
                  className="cursor-pointer border-b border-slate-800/70 transition hover:bg-slate-800/40"
                  onClick={() => onFocusPlayer(player.key)}
                >
                  <td className="px-2 py-2 font-medium text-slate-100">
                    {player.playerName}
                  </td>
                  <td className="px-2 py-2 text-slate-300">
                    {player.sessionsPlayed}
                  </td>
                  <td className="px-2 py-2 text-slate-300">{player.kills}</td>
                  <td className="px-2 py-2 text-slate-300">{player.deaths}</td>
                  <td className="px-2 py-2 text-slate-300">{player.assists}</td>
                  <td className="px-2 py-2 text-slate-300">
                    {safeRatio(
                      player.kills + player.assists,
                      player.deaths,
                    ).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-slate-300">
                    {safeRatio(player.kills, player.deaths).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-slate-300">
                    {player.damageDealt}
                  </td>
                  <td className="px-2 py-2 text-slate-300">
                    {player.healingDone}
                  </td>
                  <td className="px-2 py-2 text-slate-400">
                    {new Date(player.updatedAt).toLocaleString("en-US")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar
        currentPage={effectivePlayerPage}
        totalPages={playerTotalPages}
        totalItems={sortedFilteredPlayersCount}
        itemLabel="player(s)"
        onPrev={onPagePrev}
        onNext={onPageNext}
      />

      {focusedPlayer ? (
        <div className="mt-6 rounded-xl border border-slate-700/80 bg-slate-800/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-slate-100">
              Player detail: {focusedPlayer.playerName}
            </h3>
            <button
              type="button"
              onClick={onClosePlayer}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
            >
              Close
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-6">
            <StatCard label="Total Kills" value={focusedPlayer.kills} />
            <StatCard label="Total Deaths" value={focusedPlayer.deaths} />
            <StatCard label="Total Assists" value={focusedPlayer.assists} />
            <StatCard
              label="KDA Ratio"
              value={kda.toFixed(2)}
              valueColor="text-emerald-300"
            />
            <StatCard
              label="KD Ratio"
              value={kd.toFixed(2)}
              valueColor="text-sky-300"
            />
            <StatCard label="Sessions" value={focusedPlayer.sessionsPlayed} />
            <StatCard
              label="Total Damage"
              value={focusedPlayer.damageDealt}
              valueColor="text-amber-300"
              subLabel={`Avg./session: ${(focusedPlayer.damageDealt / Math.max(1, focusedPlayer.sessionsPlayed)).toFixed(0)}`}
              className="sm:col-span-2 lg:col-span-3"
            />
            <StatCard
              label="Total Healing"
              value={focusedPlayer.healingDone}
              valueColor="text-violet-300"
              subLabel={`Avg./session: ${(focusedPlayer.healingDone / Math.max(1, focusedPlayer.sessionsPlayed)).toFixed(0)}`}
              className="sm:col-span-2 lg:col-span-3"
            />
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400">
                  {[
                    "Session",
                    "Serveur",
                    "Date",
                    "Kills",
                    "Deaths",
                    "Assists",
                    "Damage",
                    "Healing",
                  ].map((col) => (
                    <th key={col} className="px-2 py-2">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {focusedPlayerSessions.map((row) => (
                  <tr
                    key={`${row.sessionId}-${row.createdAt}`}
                    className="border-b border-slate-800/70"
                  >
                    <td className="px-2 py-2 text-slate-200">
                      {row.sessionName}
                    </td>
                    <td className="px-2 py-2 text-slate-300">
                      {row.guildName}
                    </td>
                    <td className="px-2 py-2 text-slate-400">
                      {new Date(row.createdAt).toLocaleDateString("en-US")}
                    </td>
                    <td className="px-2 py-2 text-slate-300">{row.kills}</td>
                    <td className="px-2 py-2 text-slate-300">{row.deaths}</td>
                    <td className="px-2 py-2 text-slate-300">{row.assists}</td>
                    <td className="px-2 py-2 text-slate-300">
                      {row.damageDealt}
                    </td>
                    <td className="px-2 py-2 text-slate-300">
                      {row.healingDone}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
