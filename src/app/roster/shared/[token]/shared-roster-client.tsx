"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBiohazard,
  faBolt,
  faCrosshairs,
  faHammer,
  faHourglassHalf,
  faMinus,
  faPlus,
  faShield,
  faUser,
  faCircleQuestion,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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

type SharedGroupsByRoster = {
  first: SharedRosterGroup[];
  second: SharedRosterGroup[];
};

type RoleKey =
  | "tank"
  | "bruiser"
  | "dps"
  | "heal"
  | "debuff"
  | "dex"
  | "late"
  | "tentative"
  | "bench";

const ROLE_META: Record<
  RoleKey,
  { label: string; icon: IconDefinition; color: string }
> = {
  tank: { label: "Tank", icon: faShield, color: "text-blue-300" },
  bruiser: { label: "Bruiser", icon: faHammer, color: "text-rose-300" },
  dps: { label: "DPS", icon: faCrosshairs, color: "text-red-300" },
  heal: { label: "Heal", icon: faPlus, color: "text-emerald-300" },
  debuff: { label: "Debuff", icon: faBiohazard, color: "text-violet-300" },
  dex: { label: "Dex", icon: faBolt, color: "text-amber-300" },
  late: { label: "Late", icon: faHourglassHalf, color: "text-yellow-300" },
  tentative: {
    label: "Tentative",
    icon: faCircleQuestion,
    color: "text-slate-300",
  },
  bench: { label: "Bench", icon: faMinus, color: "text-slate-400" },
};

const ROLE_ORDER: RoleKey[] = [
  "tank",
  "bruiser",
  "heal",
  "debuff",
  "dps",
  "dex",
  "late",
  "tentative",
  "bench",
];

function normalizeRole(role: string | null): RoleKey | null {
  if (!role) {
    return null;
  }

  const key = role.trim().toLowerCase() as RoleKey;
  return key in ROLE_META ? key : null;
}

function isMercenaryName(name: string | null) {
  if (!name) {
    return false;
  }

  return /^\s*\[m\]\s*/i.test(name);
}

function normalizeDisplayName(name: string | null) {
  if (!name) {
    return "Empty";
  }

  return name.replace(/^\s*\[m\]\s*/i, "").trim() || "Empty";
}

function buildFilteredGroups(
  groupsByRoster: SharedGroupsByRoster,
  rosterFilter: "all" | "1" | "2",
): SharedGroupsByRoster {
  if (rosterFilter === "1") {
    return { first: groupsByRoster.first, second: [] };
  }

  if (rosterFilter === "2") {
    return { first: [], second: groupsByRoster.second };
  }

  return groupsByRoster;
}

function buildRosterSummary(filteredGroups: SharedGroupsByRoster) {
  const roleSummary: Record<string, number> = {};
  let mercenaryCount = 0;

  for (const group of [...filteredGroups.first, ...filteredGroups.second]) {
    for (const slot of group.slots) {
      if (!slot.playerName) {
        continue;
      }

      const role = normalizeRole(slot.role);
      const key = role ?? "unknown";
      roleSummary[key] = (roleSummary[key] ?? 0) + 1;

      if (isMercenaryName(slot.playerName)) {
        mercenaryCount += 1;
      }
    }
  }

  const totalAssigned = Object.values(roleSummary).reduce(
    (sum, count) => sum + count,
    0,
  );

  const orderedSummaryKeys = [
    ...ROLE_ORDER.filter((role) => (roleSummary[role] ?? 0) > 0),
    ...(roleSummary.unknown ? ["unknown"] : []),
  ];

  return {
    roleSummary,
    mercenaryCount,
    totalAssigned,
    orderedSummaryKeys,
  };
}

function RoleIcon({ role }: { role: string | null }) {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    return <FontAwesomeIcon icon={faUser} className="h-3 w-3 text-slate-500" />;
  }

  const meta = ROLE_META[normalizedRole];
  return (
    <FontAwesomeIcon icon={meta.icon} className={`h-3 w-3 ${meta.color}`} />
  );
}

function RoleBadge({ role }: { role: string | null }) {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    return (
      <span className="rounded-full border border-slate-700/80 bg-slate-800/70 px-2 py-0.5 text-[10px] font-medium text-slate-300">
        Unknown
      </span>
    );
  }

  const meta = ROLE_META[normalizedRole];

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/80 bg-slate-800/70 px-2 py-0.5 text-[10px] font-medium text-slate-200">
      <FontAwesomeIcon
        icon={meta.icon}
        className={`h-2.5 w-2.5 ${meta.color}`}
      />
      {meta.label}
    </span>
  );
}

function SharedRosterSlotRow({ slot }: { slot: SharedRosterSlot }) {
  const isMercenary = isMercenaryName(slot.playerName);

  return (
    <li
      key={slot.id}
      className={`flex items-center gap-2 rounded-md border px-2 py-1 ${
        isMercenary
          ? "border-amber-500/35 bg-amber-500/10"
          : "border-slate-800/80 bg-slate-950/40"
      }`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-800/90">
        <RoleIcon role={slot.role} />
      </span>
      <span
        className={`min-w-0 flex-1 truncate ${
          isMercenary ? "text-amber-100" : "text-slate-200"
        }`}
      >
        {normalizeDisplayName(slot.playerName)}
      </span>
      {isMercenary ? (
        <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300">
          Merc
        </span>
      ) : null}
      <RoleBadge role={slot.role} />
    </li>
  );
}

function SharedRosterSection({
  title,
  groups,
}: {
  title: string;
  groups: SharedRosterGroup[];
}) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {groups.map((group) => (
          <article
            key={group.id}
            className="rounded-xl border border-slate-800/80 bg-slate-900/75 p-3 shadow-lg shadow-black/20"
          >
            <h3 className="text-sm font-semibold text-slate-100 tracking-tight">
              {group.name ?? `Group ${group.groupNumber}`}
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
              {group.slots
                .sort((a, b) => a.position - b.position)
                .map((slot) => (
                  <SharedRosterSlotRow key={slot.id} slot={slot} />
                ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function SharedRosterClient({ token }: { token: string }) {
  const [rosterFilter, setRosterFilter] = useState<"all" | "1" | "2">("all");

  const query = useQuery({
    queryKey: ["shared-roster", token],
    queryFn: () =>
      apiFetch<SharedRosterResponse>(
        `/api/roster/shared/${encodeURIComponent(token)}`,
        { method: "GET" },
        "Unable to load shared roster",
      ),
    staleTime: 5_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
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

  const filteredGroups = buildFilteredGroups(groupsByRoster, rosterFilter);
  const { roleSummary, mercenaryCount, totalAssigned, orderedSummaryKeys } =
    buildRosterSummary(filteredGroups);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 px-6 pb-8 pt-10 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-800/80 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">
            {query.data.roster.name ?? "Shared roster"}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Status: {query.data.roster.status} | Updated at:{" "}
            {new Date(query.data.roster.updatedAt).toLocaleString("en-US")}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label
              className="text-xs font-medium text-slate-300"
              htmlFor="shared-roster-filter"
            >
              Filter:
            </label>
            <select
              id="shared-roster-filter"
              value={rosterFilter}
              onChange={(event) =>
                setRosterFilter(event.target.value as "all" | "1" | "2")
              }
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100"
            >
              <option value="all">All rosters</option>
              <option value="1">Roster 1</option>
              <option value="2">Roster 2</option>
            </select>
            <span className="rounded-full border border-slate-700/70 bg-slate-800/80 px-3 py-1 text-xs text-slate-300">
              Assigned players:{" "}
              <span className="font-semibold text-slate-100">
                {totalAssigned}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
              <FontAwesomeIcon
                icon={faUsers}
                className="h-3 w-3 text-amber-300"
              />
              Mercenaries:{" "}
              <span className="font-semibold">{mercenaryCount}</span>
            </span>
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200">
              Auto refresh: 15s
            </span>
          </div>

          <div className="mt-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Role recap (filtered)
            </h2>
            {orderedSummaryKeys.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                No assigned player for current filter.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {orderedSummaryKeys.map((key) => {
                  const count = roleSummary[key] ?? 0;

                  if (key === "unknown") {
                    return (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-200"
                      >
                        <FontAwesomeIcon
                          icon={faUser}
                          className="h-3 w-3 text-slate-400"
                        />
                        Unknown
                        <span className="rounded bg-slate-700/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-100">
                          {count}
                        </span>
                      </span>
                    );
                  }

                  const roleKey = key as RoleKey;
                  const meta = ROLE_META[roleKey];

                  return (
                    <span
                      key={roleKey}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-200"
                    >
                      <FontAwesomeIcon
                        icon={meta.icon}
                        className={`h-3 w-3 ${meta.color}`}
                      />
                      {meta.label}
                      <span className="rounded bg-slate-700/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-100">
                        {count}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </header>

        <SharedRosterSection title="Roster 1" groups={filteredGroups.first} />
        <SharedRosterSection title="Roster 2" groups={filteredGroups.second} />
      </div>
    </div>
  );
}
