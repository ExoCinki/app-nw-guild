"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoadingIndicator } from "@/components/loading-indicator";
import { queryPresets } from "@/lib/query-presets";

type SharedScoreboardEntry = {
  id: string;
  playerName: string;
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  healingDone: number;
};

type SharedScoreboardResponse = {
  session: {
    id: string;
    name: string | null;
    status: string;
    createdAt: string;
    shareExpiresAt: string;
    guildId: string;
    guildName: string | null;
  };
  entries: SharedScoreboardEntry[];
};

type SharedScoreboardError = Error & {
  status?: number;
};

export default function SharedScoreboardClient({ token }: { token: string }) {
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["shared-scoreboard", token],
    queryFn: async () => {
      const response = await fetch(
        `/api/scoreboard/shared/${encodeURIComponent(token)}`,
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        const error = new Error(
          payload?.error ?? "Unable to load shared scoreboard session",
        ) as SharedScoreboardError;
        error.status = response.status;
        throw error;
      }

      return response.json() as Promise<SharedScoreboardResponse>;
    },
    ...queryPresets.shortLived,
  });

  const entries = useMemo(() => {
    const source = query.data?.entries ?? [];
    const needle = search.trim().toLowerCase();

    const filtered = needle
      ? source.filter((entry) =>
          entry.playerName.toLowerCase().includes(needle),
        )
      : source;

    return [...filtered].sort((a, b) => {
      if (b.kills !== a.kills) return b.kills - a.kills;
      if (b.assists !== a.assists) return b.assists - a.assists;
      return a.playerName.localeCompare(b.playerName);
    });
  }, [query.data?.entries, search]);

  if (query.isLoading) {
    return (
      <div className="flex min-h-[calc(100vh_-_64px)] items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-8">
        <LoadingIndicator />
      </div>
    );
  }

  if (query.isError || !query.data) {
    const queryError = query.error as SharedScoreboardError | null;

    return (
      <main className="min-h-[calc(100vh_-_64px)] w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-8">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-700/60 bg-red-900/20 p-6 text-red-100">
          <h1 className="text-lg font-semibold">Share unavailable</h1>
          <p className="mt-2 text-sm text-red-200/90">
            {queryError?.message ||
              "Unable to open this shared scoreboard session"}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh_-_64px)] w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/30 backdrop-blur">
          <h1 className="text-2xl font-semibold text-slate-100">
            {query.data.session.name || "Shared scoreboard"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {query.data.session.guildName || query.data.session.guildId} -{" "}
            {query.data.session.status}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Lien valable jusqu&apos;au{" "}
            {new Date(query.data.session.shareExpiresAt).toLocaleString(
              "fr-FR",
            )}
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/30 backdrop-blur">
          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un joueur"
              className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-2 py-2">Joueur</th>
                  <th className="px-2 py-2">Kills</th>
                  <th className="px-2 py-2">Deaths</th>
                  <th className="px-2 py-2">Assists</th>
                  <th className="px-2 py-2">Damage</th>
                  <th className="px-2 py-2">Healing</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-2 py-6 text-center text-slate-500"
                    >
                      Aucun joueur a afficher.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-800/70">
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
