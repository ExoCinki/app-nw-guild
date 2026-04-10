"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http-client";
import { LoadingIndicator } from "@/components/loading-indicator";
import { queryPresets } from "@/lib/query-presets";

type SharedPayoutEntry = {
  id: string;
  username: string;
  displayName: string | null;
  wars: number;
  races: number;
  reviews: number;
  bonus: number;
  invasions: number;
  vods: number;
  points: number;
  goldEarned: number;
};

type SharedPayoutResponse = {
  session: {
    id: string;
    name: string | null;
    createdAt: string;
    shareExpiresAt: string;
    totalConfiguredBalance: number;
    totalPoints: number;
    goldPerPoint: number;
  };
  accessRole: {
    id: string;
    name: string | null;
  };
  entries: SharedPayoutEntry[];
};

export default function SharedPayoutClient({ token }: { token: string }) {
  const [search, setSearch] = useState("");

  const sharedPayoutQuery = useQuery({
    queryKey: ["shared-payout", token],
    queryFn: () =>
      apiFetch<SharedPayoutResponse>(
        `/api/payout/shared/${encodeURIComponent(token)}`,
        { method: "GET" },
        "Unable to load shared payout session",
      ),
    ...queryPresets.shortLived,
  });

  const filteredEntries = useMemo(() => {
    const entries = sharedPayoutQuery.data?.entries ?? [];

    if (!search.trim()) {
      return entries;
    }

    const lower = search.toLowerCase();
    return entries.filter((entry) => {
      const name = (entry.displayName || entry.username).toLowerCase();
      return name.includes(lower);
    });
  }, [sharedPayoutQuery.data?.entries, search]);

  if (sharedPayoutQuery.isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 pb-8 pt-24 text-slate-100">
        <div className="mx-auto max-w-6xl">
          <LoadingIndicator />
        </div>
      </div>
    );
  }

  if (sharedPayoutQuery.isError || !sharedPayoutQuery.data) {
    const errorMessage =
      sharedPayoutQuery.error instanceof Error
        ? sharedPayoutQuery.error.message
        : "Unable to open this shared payout session";

    return (
      <div className="min-h-screen bg-slate-950 px-6 pb-8 pt-24 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-700/60 bg-red-950/30 p-6">
          <h1 className="text-2xl font-semibold text-red-200">Access denied</h1>
          <p className="mt-2 text-sm text-red-100/90">{errorMessage}</p>
          <p className="mt-4 text-xs text-slate-300">
            You must be logged in and have the configured server role to view
            this session.
          </p>
        </div>
      </div>
    );
  }

  const data = sharedPayoutQuery.data;

  return (
    <div className="min-h-screen bg-slate-950 px-6 pb-8 pt-24 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-700 bg-slate-900/90 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">
                {data.session.name || "Shared payout session"}
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                Created on{" "}
                {new Date(data.session.createdAt).toLocaleDateString("en-US")}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Link expires on{" "}
                {new Date(data.session.shareExpiresAt).toLocaleDateString(
                  "en-US",
                )}
              </p>
              <p className="mt-3 text-xs text-slate-300">
                Required role: {data.accessRole.name || data.accessRole.id}
              </p>
            </div>
            <div className="w-full max-w-md">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by player name..."
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-amber-700/40 bg-amber-900/20 p-4">
            <p className="text-xs uppercase tracking-wide text-amber-300">
              Total configured balance
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-200">
              {data.session.totalConfiguredBalance.toFixed(0)} or
            </p>
          </article>
          <article className="rounded-xl border border-blue-700/40 bg-blue-900/20 p-4">
            <p className="text-xs uppercase tracking-wide text-blue-300">
              Total points
            </p>
            <p className="mt-2 text-3xl font-bold text-blue-200">
              {data.session.totalPoints}
            </p>
          </article>
          <article className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-300">
              Gold per point
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-200">
              {Math.floor(data.session.goldPerPoint)}
            </p>
          </article>
        </section>

        <section className="overflow-x-auto rounded-2xl border border-slate-700 bg-slate-900/70">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-300">
                <th className="px-3 py-3 text-left">Player</th>
                <th className="px-3 py-3 text-center">Wars</th>
                <th className="px-3 py-3 text-center">Races</th>
                <th className="px-3 py-3 text-center">Reviews</th>
                <th className="px-3 py-3 text-center">Bonus</th>
                <th className="px-3 py-3 text-center">Invasions</th>
                <th className="px-3 py-3 text-center">Management</th>
                <th className="px-3 py-3 text-center">Points</th>
                <th className="px-3 py-3 text-center">Gain</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-8 text-center text-sm text-slate-400"
                  >
                    No player matches your search.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-slate-800/80 text-slate-100"
                  >
                    <td className="px-3 py-3">
                      <div className="font-medium">
                        {entry.displayName || entry.username}
                      </div>
                      <div className="text-xs text-slate-400">
                        {entry.username}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">{entry.wars}</td>
                    <td className="px-3 py-3 text-center">{entry.races}</td>
                    <td className="px-3 py-3 text-center">{entry.reviews}</td>
                    <td className="px-3 py-3 text-center">{entry.bonus}</td>
                    <td className="px-3 py-3 text-center">{entry.invasions}</td>
                    <td className="px-3 py-3 text-center">{entry.vods}</td>
                    <td className="px-3 py-3 text-center font-semibold text-blue-300">
                      {entry.points}
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-amber-300">
                      {entry.goldEarned.toFixed(0)} or
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
