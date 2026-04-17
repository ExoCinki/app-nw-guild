"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http-client";
import { LoadingIndicator } from "@/components/loading-indicator";

type SharedRosterSlot = {
  id: string;
  position: number;
  playerName: string | null;
  role: string | null;
};

type SharedRosterGroup = {
  id: string;
  rosterIndex: number;
  groupNumber: number;
  name: string | null;
  slots: SharedRosterSlot[];
};

type SharedRosterResponse = {
  roster: {
    id: string;
    name: string | null;
    status: string;
    groups: SharedRosterGroup[];
    updatedAt: string;
  };
  sharedAt: string;
};

export default function SharedRosterClient({ token }: { token: string }) {
  const query = useQuery({
    queryKey: ["shared-roster", token],
    queryFn: () =>
      apiFetch<SharedRosterResponse>(
        `/api/roster/shared/${encodeURIComponent(token)}`,
        { method: "GET" },
        "Unable to load shared roster",
      ),
    staleTime: 30_000,
    retry: false,
  });

  if (query.isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 pb-8 pt-24 text-slate-100">
        <div className="mx-auto max-w-6xl">
          <LoadingIndicator />
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 pb-8 pt-24 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-700/60 bg-red-950/30 p-6">
          <h1 className="text-2xl font-semibold text-red-200">
            Share unavailable
          </h1>
          <p className="mt-2 text-sm text-red-100/90">
            {query.error instanceof Error
              ? query.error.message
              : "Unable to open this shared roster session"}
          </p>
        </div>
      </div>
    );
  }

  const groupsByRoster = {
    first: query.data.roster.groups
      .filter((group) => group.rosterIndex === 1)
      .sort((a, b) => a.groupNumber - b.groupNumber),
    second: query.data.roster.groups
      .filter((group) => group.rosterIndex === 2)
      .sort((a, b) => a.groupNumber - b.groupNumber),
  };

  return (
    <div className="min-h-screen bg-slate-950 px-6 pb-8 pt-10 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h1 className="text-2xl font-semibold text-slate-100">
            {query.data.roster.name ?? "Shared roster"}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Status: {query.data.roster.status} | Updated at:{" "}
            {new Date(query.data.roster.updatedAt).toLocaleString("fr-FR")}
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Roster 1
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {groupsByRoster.first.map((group) => (
              <article
                key={group.id}
                className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"
              >
                <h3 className="text-sm font-semibold text-slate-100">
                  {group.name ?? `Group ${group.groupNumber}`}
                </h3>
                <ul className="mt-2 space-y-1 text-xs text-slate-300">
                  {group.slots
                    .sort((a, b) => a.position - b.position)
                    .map((slot) => (
                      <li
                        key={slot.id}
                        className="flex items-center justify-between"
                      >
                        <span className="text-slate-500">{slot.position}</span>
                        <span className="truncate pl-2">
                          {slot.playerName ?? "Empty"}
                        </span>
                      </li>
                    ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {groupsByRoster.second.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Roster 2
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              {groupsByRoster.second.map((group) => (
                <article
                  key={group.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"
                >
                  <h3 className="text-sm font-semibold text-slate-100">
                    {group.name ?? `Group ${group.groupNumber}`}
                  </h3>
                  <ul className="mt-2 space-y-1 text-xs text-slate-300">
                    {group.slots
                      .sort((a, b) => a.position - b.position)
                      .map((slot) => (
                        <li
                          key={slot.id}
                          className="flex items-center justify-between"
                        >
                          <span className="text-slate-500">
                            {slot.position}
                          </span>
                          <span className="truncate pl-2">
                            {slot.playerName ?? "Empty"}
                          </span>
                        </li>
                      ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
