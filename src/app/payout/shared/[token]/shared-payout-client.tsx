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
    id: string | null;
    name: string | null;
  };
  entries: SharedPayoutEntry[];
};

type SharedPayoutError = Error & {
  status?: number;
  debug?: {
    linkedDiscordUserId?: string;
    oauthDiscordUserId?: string | null;
    oauthIdentity?: {
      oauthUserId: string | null;
      oauthUsername: string | null;
      oauthGlobalName: string | null;
      canSeeTargetGuild: boolean | null;
    };
    targetGuild?: {
      id: string;
      name: string | null;
    };
    discordTokens?: {
      hasAccessToken: boolean;
      hasRefreshToken: boolean;
    };
    requiredRole?: {
      id: string;
      name: string | null;
    };
    verificationSource?: string;
    checks?: {
      userToken?: {
        source: string;
        status: string;
        httpStatus?: number;
        roles: string[];
      };
      finalCheck?: {
        source: string;
        status: string;
        httpStatus?: number;
        roles: string[];
      };
    };
    detectedRoles?: Array<{
      id: string;
      name: string | null;
    }>;
  };
};

type SortKey =
  | "name"
  | "wars"
  | "races"
  | "reviews"
  | "bonus"
  | "invasions"
  | "vods"
  | "points"
  | "goldEarned";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return <span className="ml-1 text-slate-600">↕</span>;
  }
  return (
    <span className="ml-1 text-slate-300">{dir === "asc" ? "↑" : "↓"}</span>
  );
}

export default function SharedPayoutClient({ token }: { token: string }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("goldEarned");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

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
    const entries = (sharedPayoutQuery.data?.entries ?? []).filter(
      (entry) => entry.goldEarned > 0,
    );

    const searched = search.trim()
      ? entries.filter((entry) => {
          const name = (entry.displayName || entry.username).toLowerCase();
          return name.includes(search.toLowerCase());
        })
      : entries;

    return [...searched].sort((a, b) => {
      let valA: number | string;
      let valB: number | string;

      if (sortKey === "name") {
        valA = (a.displayName || a.username).toLowerCase();
        valB = (b.displayName || b.username).toLowerCase();
      } else {
        valA = a[sortKey];
        valB = b[sortKey];
      }

      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [sharedPayoutQuery.data?.entries, search, sortKey, sortDir]);

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
    const queryError = sharedPayoutQuery.error as SharedPayoutError | null;
    const errorMessage =
      queryError instanceof Error
        ? queryError.message
        : "Unable to open this shared payout session";
    const debug = queryError?.debug;

    return (
      <div className="min-h-screen bg-slate-950 px-6 pb-8 pt-24 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-700/60 bg-red-950/30 p-6">
          <h1 className="text-2xl font-semibold text-red-200">Access denied</h1>
          <p className="mt-2 text-sm text-red-100/90">{errorMessage}</p>
          <p className="mt-4 text-xs text-slate-300">
            This shared link may be invalid, expired, or no longer available.
          </p>
          {debug ? (
            <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/40 p-4 text-xs text-slate-200">
              <p>
                Required role: {debug.requiredRole?.name || "Unknown role"} (
                {debug.requiredRole?.id || "n/a"})
              </p>
              <p className="mt-2">
                Linked Discord user ID: {debug.linkedDiscordUserId || "unknown"}
              </p>
              <p className="mt-2">
                OAuth Discord user ID: {debug.oauthDiscordUserId || "unknown"}
              </p>
              <p className="mt-2">
                OAuth identity:{" "}
                {debug.oauthIdentity?.oauthGlobalName ||
                  debug.oauthIdentity?.oauthUsername ||
                  "unknown"}
                {debug.oauthIdentity?.oauthUserId
                  ? ` (${debug.oauthIdentity.oauthUserId})`
                  : ""}
              </p>
              <p className="mt-2">
                Target guild: {debug.targetGuild?.name || "Unknown guild"} (
                {debug.targetGuild?.id || "n/a"})
              </p>
              <p className="mt-2">
                OAuth can see target guild:{" "}
                {debug.oauthIdentity?.canSeeTargetGuild === null
                  ? "unknown"
                  : debug.oauthIdentity?.canSeeTargetGuild
                    ? "yes"
                    : "no"}
              </p>
              <p className="mt-2">
                Discord tokens: access=
                {debug.discordTokens?.hasAccessToken ? "yes" : "no"}, refresh=
                {debug.discordTokens?.hasRefreshToken ? "yes" : "no"}
              </p>
              <p className="mt-2">
                Verification source: {debug.verificationSource || "unknown"}
              </p>
              <div className="mt-2 text-slate-300">
                <p>
                  User-token check:{" "}
                  {debug.checks?.userToken?.status || "unknown"}
                  {debug.checks?.userToken?.httpStatus
                    ? ` (HTTP ${debug.checks.userToken.httpStatus})`
                    : ""}
                </p>
                <p>
                  Final check: {debug.checks?.finalCheck?.status || "unknown"}
                  {debug.checks?.finalCheck?.httpStatus
                    ? ` (HTTP ${debug.checks.finalCheck.httpStatus})`
                    : ""}
                </p>
              </div>
              <div className="mt-2">
                <p>Detected roles:</p>
                {debug.detectedRoles && debug.detectedRoles.length > 0 ? (
                  <ul className="mt-1 space-y-1 text-slate-300">
                    {debug.detectedRoles.map((role) => (
                      <li key={role.id}>
                        {role.name || "Unknown role"} ({role.id})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-slate-400">No roles detected.</p>
                )}
              </div>
            </div>
          ) : null}
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
              {data.session.totalConfiguredBalance.toFixed(0)}
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
                {(
                  [
                    { key: "name", label: "Player", align: "left" },
                    { key: "wars", label: "Wars", align: "center" },
                    { key: "races", label: "Races", align: "center" },
                    { key: "reviews", label: "Reviews", align: "center" },
                    { key: "bonus", label: "Bonus", align: "center" },
                    { key: "invasions", label: "Invasions", align: "center" },
                    { key: "vods", label: "Management", align: "center" },
                    { key: "points", label: "Points", align: "center" },
                    { key: "goldEarned", label: "Gain", align: "center" },
                  ] as {
                    key: SortKey;
                    label: string;
                    align: "left" | "center";
                  }[]
                ).map(({ key, label, align }) => (
                  <th
                    key={key}
                    className={`px-3 py-3 text-${align} cursor-pointer select-none whitespace-nowrap hover:text-slate-100`}
                    onClick={() => handleSort(key)}
                  >
                    {label}
                    <SortIcon active={sortKey === key} dir={sortDir} />
                  </th>
                ))}
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
                      {entry.goldEarned.toFixed(0)}
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
