"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faShield,
  faHammer,
  faCrosshairs,
  faPlus,
  faBiohazard,
  faBolt,
  faCircleQuestion,
  faHourglassHalf,
  faMinus,
  faUser,
  faPencil,
  faCheck,
  faXmark,
  faCalendarDays,
  faRotateRight,
  faTrash,
  faArchive,
  faLock,
  faLockOpen,
  faShareNodes,
  faFlag,
  faKhanda,
} from "@fortawesome/free-solid-svg-icons";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  InlineLoadingIndicator,
  LoadingIndicator,
} from "@/components/loading-indicator";

// ─── Types ────────────────────────────────────────────────────────────────────

type RosterSlotData = {
  position: number;
  playerName: string | null;
  role: string | null;
};

type RosterGroupData = {
  groupNumber: number;
  name: string | null;
  slots: RosterSlotData[];
};

type RosterResponse = {
  guild: { id: string; name: string | null };
  rosterSession: {
    id: string;
    name: string | null;
    status: string;
    isLocked: boolean;
    lockedByUserId: string | null;
  };
  roster: {
    selectedEventId: string | null;
    selectedImportFilterPreset: RaidHelperImportFilterPreset;
    playerSearchQuery: string;
    enableSecondRoster: boolean;
    groups: RosterGroupData[];
    secondGroups: RosterGroupData[];
  };
};

type RosterSessionSummary = {
  id: string;
  name: string | null;
  status: string;
  isLocked: boolean;
  lockedByUserId: string | null;
  shares?: Array<{ shareUrl: string; updatedAt: string }>;
  playersCount?: number;
};

type PostGroupPayload = {
  guildId?: string;
  sessionId?: string;
  rosterIndex?: 1 | 2;
  groupNumber: number;
  name: string | null;
  slots: Array<{
    position: number;
    playerName: string | null;
    role: string | null;
  }>;
};

type RaidHelperEvent = {
  id: string;
  channelId: string;
  title: string;
  startTime: number;
  endTime: number | null;
  signUps: number;
  leaderId: string;
  leaderName: string | null;
  description: string | null;
};

type RaidHelperEventsResponse = {
  events: RaidHelperEvent[];
  channelId: string;
  eventsCachedAt?: string | null;
};

type RaidHelperParticipant = {
  name: string | null;
  userId: string | null;
  specName: string | null;
  className: string | null;
};

type RaidHelperImportFilterPreset = "classic" | "euna";

type RaidHelperParticipantsResponse = {
  participants: RaidHelperParticipant[];
  participantsCachedAt?: string | null;
};

type DragParticipantPayload = {
  name: string | null;
  userId: string | null;
  specName: string | null;
  className: string | null;
};

function normalizeRoleToken(value: string | null) {
  return (
    value?.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ") ??
    null
  );
}

function normalizeCompactToken(value: string | null) {
  return (
    value
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "") ?? null
  );
}

function isMercenaryName(value: string | null | undefined) {
  return /^\s*\[m\]\s*/i.test(value ?? "");
}

function stripMercenaryPrefix(value: string | null | undefined) {
  return (value ?? "").replace(/^\s*\[m\]\s*/i, "").trim();
}

function withMercenaryPrefix(value: string | null | undefined) {
  const normalized = stripMercenaryPrefix(value);
  return normalized ? `[M] ${normalized}` : null;
}

function formatRefreshDateTime(value: string | Date | null | undefined) {
  if (!value) {
    return "Never";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Never";
  }

  return parsed.toLocaleString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isDataStale(value: string | null | undefined, thresholdMinutes = 30) {
  if (!value) {
    return true;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return true;
  }

  return Date.now() - parsed.getTime() > thresholdMinutes * 60 * 1000;
}

function matchesPair(
  left: string | null,
  right: string | null,
  expectedA: string,
  expectedB: string,
) {
  return (
    (left === expectedA && right === expectedB) ||
    (left === expectedB && right === expectedA)
  );
}

function resolveParticipantRoleClassic(
  participant: RaidHelperParticipant,
): RoleKey {
  const specName = normalizeRoleToken(participant.specName);
  const className = normalizeRoleToken(participant.className);

  if (!specName && !className) {
    return null;
  }

  if (specName === "life staff" || className === "life staff") {
    return "heal";
  }

  if (specName === "tentative" || className === "tentative") {
    return "tentative";
  }

  if (specName === "late" || className === "late") {
    return "late";
  }

  if (matchesPair(specName, className, "life staff", "rapier")) {
    return "heal";
  }

  if (matchesPair(specName, className, "great axe", "war hammer")) {
    return "bruiser";
  }

  if (matchesPair(specName, className, "hatchet", "sword")) {
    return "tank";
  }

  if (matchesPair(specName, className, "sword", "great axe")) {
    return "dex";
  }

  if (matchesPair(specName, className, "greatsword", "hatchet")) {
    return "dex";
  }

  if (matchesPair(specName, className, "rapier", "great axe")) {
    return "dex";
  }

  if (matchesPair(specName, className, "flail", "great axe")) {
    return "dex";
  }

  if (matchesPair(specName, className, "flail", "sword")) {
    return "tank";
  }

  if (matchesPair(specName, className, "sword", "ice gauntlet")) {
    return "tank";
  }

  if (matchesPair(specName, className, "life staff", "flail")) {
    return "heal";
  }

  if (matchesPair(specName, className, "life staff", "spear")) {
    return "heal";
  }

  if (matchesPair(specName, className, "spear", "hatchet")) {
    return "dex";
  }

  if (matchesPair(specName, className, "bow", "hatchet")) {
    return "dps";
  }

  if (matchesPair(specName, className, "bow", "great axe")) {
    return "dps";
  }

  if (matchesPair(specName, className, "void gauntlet", "hatchet")) {
    return "dex";
  }

  if (matchesPair(specName, className, "musket", "spear")) {
    return "dex";
  }

  if (matchesPair(specName, className, "fire staff", "void gauntlet")) {
    return "dps";
  }

  if (matchesPair(specName, className, "fire staff", "ice gauntlet")) {
    return "dps";
  }

  if (
    specName === "bow" ||
    className === "bow" ||
    specName === "fire staff" ||
    className === "fire staff"
  ) {
    return "dps";
  }

  if (matchesPair(specName, className, "void gauntlet", "ice gauntlet")) {
    return "debuff";
  }

  return null;
}

const EUNA_ALLOWED_FACTIONS = new Set(["syndicate", "covenant", "marauder"]);
const EUNA_FACTION_OPTIONS = ["syndicate", "covenant", "marauder"] as const;
const EUNA_OVERRIDE_PREFIX = "euna:";

const EUNA_SPEC_TO_ROLE: Record<string, RoleKey> = {
  caller: "tank",
  tank: "tank",
  bruiser: "bruiser",
  igvg: "debuff",
  healeraoe: "heal",
  healerquad: "heal",
  meleedex: "dex",
  voidblade: "dex",
  healerdex: "heal",
  flail: "tank",
  crescentwave: "heal",
  firestaff: "dps",
  bow: "dps",
  musket: "dps",
};

const EUNA_SPEC_LABELS: Record<string, string> = {
  caller: "Caller",
  tank: "Tank",
  bruiser: "Bruiser",
  igvg: "IG/VG",
  healeraoe: "Healer AOE",
  healerquad: "Healer Quad",
  meleedex: "Melee Dex",
  voidblade: "Voidblade",
  healerdex: "Healer Dex",
  flail: "Flail",
  crescentwave: "Crescent Wave",
  firestaff: "Fire Staff",
  bow: "Bow",
  musket: "Musket",
};

function resolveParticipantRoleEuna(
  participant: RaidHelperParticipant,
): RoleKey {
  const factionName = normalizeRoleToken(participant.className);
  if (!factionName || !EUNA_ALLOWED_FACTIONS.has(factionName)) {
    return null;
  }

  const specName = normalizeCompactToken(participant.specName);
  if (!specName) {
    return null;
  }

  return EUNA_SPEC_TO_ROLE[specName] ?? null;
}

function resolveParticipantFactionEuna(participant: RaidHelperParticipant) {
  const factionName = normalizeRoleToken(participant.className);

  if (!factionName || !EUNA_ALLOWED_FACTIONS.has(factionName)) {
    return null;
  }

  return factionName;
}

function formatFactionLabel(faction: string | null) {
  if (!faction) {
    return "N/A";
  }

  return faction.charAt(0).toUpperCase() + faction.slice(1);
}

function parseEunaOverrideToken(value: string | null | undefined) {
  const raw = value?.trim() ?? "";

  if (!raw.toLowerCase().startsWith(EUNA_OVERRIDE_PREFIX)) {
    return null;
  }

  const payload = raw.slice(EUNA_OVERRIDE_PREFIX.length);
  const [rawFaction = "", rawSpec = ""] = payload.split("|", 2);

  const factionToken = normalizeRoleToken(rawFaction);
  const specToken = normalizeCompactToken(rawSpec);

  return {
    factionOverride:
      factionToken && EUNA_ALLOWED_FACTIONS.has(factionToken)
        ? factionToken
        : null,
    specOverride:
      specToken && specToken in EUNA_SPEC_TO_ROLE ? specToken : null,
  };
}

function buildEunaOverrideToken(
  factionOverride: string | null | undefined,
  specOverride: string | null | undefined,
) {
  const factionToken = normalizeRoleToken(factionOverride ?? null);
  const specToken = normalizeCompactToken(specOverride ?? null);

  const nextFaction =
    factionToken && EUNA_ALLOWED_FACTIONS.has(factionToken) ? factionToken : "";
  const nextSpec = specToken && specToken in EUNA_SPEC_TO_ROLE ? specToken : "";

  if (!nextFaction && !nextSpec) {
    return null;
  }

  return `${EUNA_OVERRIDE_PREFIX}${nextFaction}|${nextSpec}`;
}

function resolveParticipantRoleByPreset(
  participant: RaidHelperParticipant,
  preset: RaidHelperImportFilterPreset,
): RoleKey {
  if (preset === "euna") {
    return resolveParticipantRoleEuna(participant);
  }

  return resolveParticipantRoleClassic(participant);
}

function resolveParticipantRole(participant: RaidHelperParticipant): RoleKey {
  return resolveParticipantRoleClassic(participant);
}

function shouldIncludeParticipantByPreset(
  participant: RaidHelperParticipant,
  preset: RaidHelperImportFilterPreset,
) {
  if (preset === "classic") {
    return true;
  }

  // In EUNA mode, keep unmatched participants visible and mark them as N/A.
  return true;
}

// ─── Roles ────────────────────────────────────────────────────────────────────

type RoleKey =
  | "tank"
  | "bruiser"
  | "dps"
  | "heal"
  | "debuff"
  | "dex"
  | "late"
  | "tentative"
  | "bench"
  | null;

type ParticipantCountBadge = {
  key: string;
  count: number;
  icon: IconDefinition;
  color: string;
  label: string;
};

const ROLE_META: Record<
  string,
  { label: string; icon: IconDefinition; color: string }
> = {
  tank: { label: "Tank", icon: faShield, color: "text-blue-400" },
  bruiser: { label: "Bruiser", icon: faHammer, color: "text-rose-400" },
  dps: { label: "DPS", icon: faCrosshairs, color: "text-red-400" },
  heal: { label: "Heal", icon: faPlus, color: "text-emerald-400" },
  debuff: { label: "Debuff", icon: faBiohazard, color: "text-violet-400" },
  dex: { label: "Dex", icon: faBolt, color: "text-amber-400" },
  late: { label: "Late", icon: faHourglassHalf, color: "text-yellow-400" },
  tentative: {
    label: "Tentative",
    icon: faCircleQuestion,
    color: "text-slate-400",
  },
  bench: { label: "Bench", icon: faMinus, color: "text-slate-500" },
};

const ROLE_SORT_PRIORITY: Record<string, number> = {
  tank: 0,
  bruiser: 1,
  heal: 2,
  debuff: 3,
  dps: 4,
  dex: 5,
  late: 6,
  tentative: 7,
  bench: 8,
};

function RoleIcon({
  role,
  size = "sm",
}: {
  role: string | null;
  size?: "sm" | "md";
}) {
  const meta = role ? ROLE_META[role] : null;
  const sizeClass = size === "md" ? "h-4 w-4" : "h-3 w-3";
  if (!meta) {
    return (
      <FontAwesomeIcon
        icon={faUser}
        className={`${sizeClass} text-slate-600`}
      />
    );
  }
  return (
    <FontAwesomeIcon
      icon={meta.icon}
      className={`${sizeClass} ${meta.color}`}
    />
  );
}

const FACTION_META: Record<string, string> = {
  marauder: "text-emerald-400",
  covenant: "text-yellow-400",
  syndicate: "text-violet-400",
};

function FactionIcon({
  faction,
  size = "sm",
}: {
  faction: string | null;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "md" ? "h-4 w-4" : "h-3 w-3";
  const colorClass = faction
    ? (FACTION_META[faction] ?? "text-slate-500")
    : "text-slate-600";

  return (
    <FontAwesomeIcon icon={faFlag} className={`${sizeClass} ${colorClass}`} />
  );
}

const ACTION_BUTTON_BASE =
  "rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40";

const ACTION_BUTTON_VARIANTS = {
  neutral: "border-slate-600/60 bg-slate-800 text-slate-300 hover:bg-slate-700",
  success:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-500/60 hover:bg-emerald-500/20",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-400 hover:border-sky-500/60 hover:bg-sky-500/20",
  primary:
    "border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:border-indigo-500/60 hover:bg-indigo-500/20",
  warning:
    "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:border-amber-500/60 hover:bg-amber-500/20",
  danger:
    "border-red-500/30 bg-red-500/10 text-red-400 hover:border-red-500/60 hover:bg-red-500/20",
  dangerAlt:
    "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:border-rose-500/60 hover:bg-rose-500/20",
} as const;

type ActionButtonVariant = keyof typeof ACTION_BUTTON_VARIANTS;

function actionButtonClass(variant: ActionButtonVariant, withIcon = false) {
  const iconClass = withIcon ? " flex items-center gap-1.5" : "";
  return `${ACTION_BUTTON_BASE}${iconClass} ${ACTION_BUTTON_VARIANTS[variant]}`;
}

function RosterSessionToolbar({
  activeSessionId,
  sessions,
  activeSession,
  activeShareUrl,
  isCreatingSession,
  isRenamingSession,
  isLockingSession,
  isSharingSession,
  isDisablingShare,
  isArchiving,
  isClearing,
  isDeletingSession,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onToggleLockSession,
  onShareSession,
  onDisableShare,
  onOpenArchiveConfirm,
  onOpenClearConfirm,
  onDeleteSession,
}: {
  activeSessionId: string | null;
  sessions: RosterSessionSummary[];
  activeSession: RosterSessionSummary | null;
  activeShareUrl: string | null;
  isCreatingSession: boolean;
  isRenamingSession: boolean;
  isLockingSession: boolean;
  isSharingSession: boolean;
  isDisablingShare: boolean;
  isArchiving: boolean;
  isClearing: boolean;
  isDeletingSession: boolean;
  onSelectSession: (sessionId: string | null) => void;
  onCreateSession: () => void;
  onRenameSession: () => void;
  onToggleLockSession: () => void;
  onShareSession: () => void;
  onDisableShare: () => void;
  onOpenArchiveConfirm: () => void;
  onOpenClearConfirm: () => void;
  onDeleteSession: () => void;
}) {
  return (
    <div className="flex w-full max-w-[980px] flex-col gap-2 xl:items-end">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-950/40 p-2">
        <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Session
        </span>
        <select
          value={activeSessionId ?? ""}
          onChange={(event) => onSelectSession(event.target.value || null)}
          className="min-w-[220px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100"
        >
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name ?? "Untitled session"}
              {session.isLocked ? " (Locked)" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onCreateSession}
          disabled={isCreatingSession}
          className={actionButtonClass("success")}
          title="Create roster session"
        >
          New session
        </button>
        <button
          type="button"
          onClick={onRenameSession}
          disabled={!activeSessionId || isRenamingSession}
          className={actionButtonClass("neutral", true)}
          title="Rename session"
        >
          <FontAwesomeIcon icon={faPencil} className="h-3 w-3" />
          Rename
        </button>
        <button
          type="button"
          onClick={onToggleLockSession}
          disabled={!activeSessionId || isLockingSession}
          className={actionButtonClass("neutral", true)}
          title={activeSession?.isLocked ? "Unlock session" : "Lock session"}
        >
          <FontAwesomeIcon
            icon={activeSession?.isLocked ? faLock : faLockOpen}
            className="h-3 w-3"
          />
          {activeSession?.isLocked ? "Locked" : "Open"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-950/40 p-2">
        <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Actions
        </span>
        <button
          type="button"
          onClick={onShareSession}
          disabled={!activeSessionId || isSharingSession}
          className={actionButtonClass("primary", true)}
          title="Generate share link"
        >
          <FontAwesomeIcon icon={faShareNodes} className="h-3 w-3" />
          Share
        </button>
        {activeShareUrl ? (
          <button
            type="button"
            onClick={onDisableShare}
            disabled={isDisablingShare}
            className={actionButtonClass("warning")}
            title="Disable share link"
          >
            Disable share
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpenArchiveConfirm}
          disabled={isArchiving}
          className={actionButtonClass("info", true)}
          title="Archive current roster"
        >
          <FontAwesomeIcon icon={faArchive} className="h-3 w-3" />
          Archive
        </button>
        <button
          type="button"
          onClick={onOpenClearConfirm}
          disabled={isClearing}
          className={actionButtonClass("danger", true)}
          title="Clear roster"
        >
          <FontAwesomeIcon icon={faTrash} className="h-3 w-3" />
          Clear
        </button>
        <button
          type="button"
          onClick={onDeleteSession}
          disabled={!activeSessionId || isDeletingSession}
          className={actionButtonClass("dangerAlt")}
          title="Delete session"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchRoster(sessionId: string | null): Promise<RosterResponse> {
  const suffix = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
  const res = await fetch(`/api/roster${suffix}`, { credentials: "include" });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "Unable to load roster.");
  }
  return res.json() as Promise<RosterResponse>;
}

async function saveGroup(payload: PostGroupPayload): Promise<RosterResponse> {
  const res = await fetch("/api/roster", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "Unable to save.");
  }
  return res.json() as Promise<RosterResponse>;
}

async function updateSlot(payload: {
  guildId?: string;
  sessionId?: string;
  rosterIndex: 1 | 2;
  groupNumber: number;
  slotPosition: number;
  playerName: string | null;
  role: string | null;
}): Promise<{
  slot: {
    rosterIndex: number;
    groupNumber: number;
    slotPosition: number;
    playerName: string | null;
    role: string | null;
  };
}> {
  const res = await fetch("/api/roster/slot", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "Unable to update slot.");
  }
  return res.json() as Promise<{
    slot: {
      rosterIndex: number;
      groupNumber: number;
      slotPosition: number;
      playerName: string | null;
      role: string | null;
    };
  }>;
}

async function archiveRosterForSession(sessionId: string | null): Promise<{
  success: boolean;
  archiveId: string;
}> {
  const res = await fetch("/api/roster/archive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ sessionId: sessionId ?? undefined }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "Unable to archive roster.");
  }

  return res.json() as Promise<{ success: boolean; archiveId: string }>;
}

async function clearRoster(sessionId: string | null): Promise<RosterResponse> {
  const suffix = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
  const res = await fetch(`/api/roster${suffix}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "Unable to clear roster.");
  }

  return res.json() as Promise<RosterResponse>;
}

async function saveSelectedEventId(
  sessionId: string | null,
  selectedEventId: string | null,
): Promise<RosterResponse> {
  const suffix = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
  const res = await fetch(`/api/roster${suffix}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      selectedEventId,
      sessionId: sessionId ?? undefined,
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "Unable to save event.");
  }

  return res.json() as Promise<RosterResponse>;
}

async function saveSelectedImportFilterPreset(
  sessionId: string | null,
  selectedImportFilterPreset: RaidHelperImportFilterPreset,
): Promise<RosterResponse> {
  const suffix = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
  const res = await fetch(`/api/roster${suffix}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      selectedImportFilterPreset,
      sessionId: sessionId ?? undefined,
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "Unable to save import filter preset.");
  }

  return res.json() as Promise<RosterResponse>;
}

async function saveSelectedPlayerSearchQuery(
  sessionId: string | null,
  selectedPlayerSearchQuery: string,
): Promise<RosterResponse> {
  const suffix = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
  const res = await fetch(`/api/roster${suffix}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      selectedPlayerSearchQuery,
      sessionId: sessionId ?? undefined,
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "Unable to save player search query.");
  }

  return res.json() as Promise<RosterResponse>;
}

async function fetchRaidHelperEvents(
  sessionId: string | null,
): Promise<RaidHelperEventsResponse> {
  return fetchRaidHelperEventsWithMode(sessionId, false);
}

async function fetchRaidHelperEventsWithMode(
  sessionId: string | null,
  forceRefresh: boolean,
): Promise<RaidHelperEventsResponse> {
  const params = new URLSearchParams();
  if (forceRefresh) params.set("refresh", "1");
  if (sessionId) params.set("sessionId", sessionId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/raid-helper-events${suffix}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "Unable to load RaidHelper events.");
  }
  return res.json() as Promise<RaidHelperEventsResponse>;
}

async function fetchRaidHelperParticipants(
  sessionId: string | null,
  eventId: string,
): Promise<RaidHelperParticipantsResponse> {
  return fetchRaidHelperParticipantsWithMode(sessionId, eventId, false);
}

async function fetchRaidHelperParticipantsWithMode(
  sessionId: string | null,
  eventId: string,
  forceRefresh: boolean,
): Promise<RaidHelperParticipantsResponse> {
  const params = new URLSearchParams({ eventId });
  if (forceRefresh) params.set("refresh", "1");
  if (sessionId) params.set("sessionId", sessionId);
  const res = await fetch(`/api/raid-helper-events?${params.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "Unable to load RaidHelper participants.");
  }
  return res.json() as Promise<RaidHelperParticipantsResponse>;
}

async function fetchRosterSessions(): Promise<RosterSessionSummary[]> {
  const res = await fetch("/api/roster/sessions", {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "Unable to load roster sessions.");
  }
  return res.json() as Promise<RosterSessionSummary[]>;
}

async function createRosterSession(
  name?: string,
): Promise<RosterSessionSummary> {
  const res = await fetch("/api/roster/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "Unable to create roster session.");
  }
  return res.json() as Promise<RosterSessionSummary>;
}

async function updateRosterSession(
  id: string,
  payload: { name?: string | null; isLocked?: boolean },
): Promise<RosterSessionSummary> {
  const res = await fetch(`/api/roster/sessions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "Unable to update roster session.");
  }
  return res.json() as Promise<RosterSessionSummary>;
}

async function deleteRosterSession(id: string): Promise<void> {
  const res = await fetch(`/api/roster/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "Unable to delete roster session.");
  }
}

async function createRosterShareLink(
  id: string,
): Promise<{ shareUrl: string }> {
  const res = await fetch(
    `/api/roster/sessions/${encodeURIComponent(id)}/share`,
    {
      method: "POST",
      credentials: "include",
    },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "Unable to generate share link.");
  }
  return res.json() as Promise<{ shareUrl: string }>;
}

async function deleteRosterShareLink(id: string): Promise<void> {
  const res = await fetch(
    `/api/roster/sessions/${encodeURIComponent(id)}/share`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "Unable to disable share link.");
  }
}

// ─── GroupCard ─────────────────────────────────────────────────────────────────

function GroupCard({
  sessionId,
  rosterIndex,
  group,
  onSaved,
  onDropParticipant,
  pendingDropTarget,
  queryClient,
}: {
  sessionId: string | null;
  rosterIndex: 1 | 2;
  group: RosterGroupData;
  onSaved: (updated: RosterResponse) => void;
  onDropParticipant: (input: {
    rosterIndex: 1 | 2;
    groupNumber: number;
    slotPosition: number;
    playerName: string;
    role?: string | null;
  }) => void;
  pendingDropTarget: string | null;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [localName, setLocalName] = useState(group.name ?? "");
  const [editingSlotPosition, setEditingSlotPosition] = useState<number | null>(
    null,
  );
  const [editingPlayerName, setEditingPlayerName] = useState("");
  const [editingRole, setEditingRole] = useState<RoleKey>(null);

  function startEdit() {
    setLocalName(group.name ?? "");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  function startSlotEdit(slot: RosterSlotData) {
    setEditingSlotPosition(slot.position);
    setEditingPlayerName(slot.playerName ?? "");
    setEditingRole(slot.role as RoleKey);
  }

  function cancelSlotEdit() {
    setEditingSlotPosition(null);
    setEditingPlayerName("");
    setEditingRole(null);
  }

  async function confirmSlotEdit() {
    const trimmedName = editingPlayerName.trim();
    if (!trimmedName) {
      toast.error("Player name cannot be empty.");
      return;
    }

    setPending(true);
    try {
      // Optimistic update: update local cache immediately
      const currentData = queryClient.getQueryData(["roster", sessionId]) as
        | RosterResponse
        | undefined;
      if (currentData && editingSlotPosition !== null) {
        const updatedGroups =
          rosterIndex === 1
            ? currentData.roster.groups.map((g) =>
                g.groupNumber === group.groupNumber
                  ? {
                      ...g,
                      slots: g.slots.map((s) =>
                        s.position === editingSlotPosition
                          ? {
                              ...s,
                              playerName: trimmedName,
                              role: editingRole,
                            }
                          : s,
                      ),
                    }
                  : g,
              )
            : currentData.roster.groups;

        const updatedSecondGroups =
          rosterIndex === 2
            ? currentData.roster.secondGroups.map((g) =>
                g.groupNumber === group.groupNumber
                  ? {
                      ...g,
                      slots: g.slots.map((s) =>
                        s.position === editingSlotPosition
                          ? {
                              ...s,
                              playerName: trimmedName,
                              role: editingRole,
                            }
                          : s,
                      ),
                    }
                  : g,
              )
            : currentData.roster.secondGroups;

        const updatedData: RosterResponse = {
          ...currentData,
          roster: {
            ...currentData.roster,
            groups: updatedGroups,
            secondGroups: updatedSecondGroups,
          },
        };
        queryClient.setQueryData(["roster", sessionId], updatedData);
      }

      // Send to server with lightweight endpoint
      await updateSlot({
        sessionId: sessionId ?? undefined,
        rosterIndex,
        groupNumber: group.groupNumber,
        slotPosition: editingSlotPosition!,
        playerName: trimmedName,
        role: editingRole,
      });

      // Sync in background without blocking the UI.
      void queryClient.invalidateQueries({ queryKey: ["roster", sessionId] });

      setEditingSlotPosition(null);
      setEditingPlayerName("");
      setEditingRole(null);
      toast.success("Player added to roster.");
    } catch (error) {
      // Refetch to restore correct state on error
      queryClient.invalidateQueries({ queryKey: ["roster", sessionId] });
      toast.error(error instanceof Error ? error.message : "Unknown error.");
    } finally {
      setPending(false);
    }
  }

  async function confirmEdit() {
    setPending(true);
    try {
      const payload: PostGroupPayload = {
        sessionId: sessionId ?? undefined,
        rosterIndex,
        groupNumber: group.groupNumber,
        name: localName.trim() || null,
        slots: group.slots.map((slot) => ({
          position: slot.position,
          playerName: slot.playerName,
          role: slot.role,
        })),
      };
      const data = await saveGroup(payload);
      onSaved(data);
      setEditing(false);
      toast.success(`Group name ${group.groupNumber} saved.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setPending(false);
    }
  }

  const displayName = group.name ?? `Group ${group.groupNumber}`;

  return (
    <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/80 shadow-md shadow-black/20">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {editing ? (
            <input
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              placeholder={`Group ${group.groupNumber}`}
              className="w-full rounded bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-100 outline-none focus:ring-1 focus:ring-sky-500"
            />
          ) : (
            <span className="truncate text-xs font-semibold text-slate-200">
              {displayName}
            </span>
          )}

          {editing ? (
            <>
              <button
                type="button"
                onClick={confirmEdit}
                disabled={pending}
                className="rounded border border-emerald-500/60 px-1.5 py-1 text-emerald-400/70 disabled:opacity-40"
                aria-label="Confirm"
              >
                <FontAwesomeIcon icon={faCheck} className="h-2.5 w-2.5" />
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={pending}
                className="rounded border border-rose-500/60 px-1.5 py-1 text-rose-400/70 disabled:opacity-40"
                aria-label="Cancel"
              >
                <FontAwesomeIcon icon={faXmark} className="h-2.5 w-2.5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="text-[10px] text-slate-500 transition-colors hover:text-slate-300"
              aria-label="Edit"
            >
              <FontAwesomeIcon icon={faPencil} className="h-2 w-2" />
            </button>
          )}
        </div>
      </div>

      {/* Slots */}
      <div className="flex flex-col gap-1 p-2">
        {group.slots.map((slot) => {
          const displayPlayer = slot.playerName;
          const isEmpty = !displayPlayer;
          const isMercenary = isMercenaryName(displayPlayer);
          const displayRole = isEmpty ? null : (slot.role as RoleKey);
          const slotKey = `${rosterIndex}-${group.groupNumber}-${slot.position}`;
          const isPendingDrop = pendingDropTarget === slotKey;
          const isHovered = hoveredSlot === slot.position;
          const isEditingThisSlot = editingSlotPosition === slot.position;

          // If editing this slot, show the edit form
          if (isEditingThisSlot) {
            return (
              <div
                key={slot.position}
                className="flex flex-col gap-2 rounded-md border border-sky-500/40 bg-sky-500/5 p-2"
              >
                <input
                  type="text"
                  value={editingPlayerName}
                  onChange={(e) => setEditingPlayerName(e.target.value)}
                  placeholder="Player name"
                  className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-sky-500"
                  autoFocus
                />
                <div className="flex gap-2">
                  <select
                    value={editingRole ?? ""}
                    onChange={(e) =>
                      setEditingRole((e.target.value as RoleKey) || null)
                    }
                    className="flex-1 rounded bg-slate-800 px-2 py-1 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">No role</option>
                    {Object.entries(ROLE_META)
                      .filter(([key]) => key !== "bench")
                      .map(([key, value]) => (
                        <option key={key} value={key}>
                          {value.label}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={confirmSlotEdit}
                    disabled={pending}
                    className="flex-1 rounded border border-emerald-500/60 py-1 text-emerald-400/70 text-xs transition hover:bg-emerald-500/10 disabled:opacity-40"
                  >
                    <FontAwesomeIcon icon={faCheck} className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelSlotEdit}
                    disabled={pending}
                    className="flex-1 rounded border border-rose-500/60 py-1 text-rose-400/70 text-xs transition hover:bg-rose-500/10 disabled:opacity-40"
                  >
                    <FontAwesomeIcon icon={faXmark} className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={slot.position}
              className={`flex items-center gap-2 rounded-md px-1 transition ${
                !editing && (isHovered || isPendingDrop)
                  ? "bg-sky-500/10 outline outline-1 outline-sky-500/40"
                  : ""
              } ${isEmpty && !editing ? "cursor-pointer hover:bg-slate-800/50" : ""}`}
              onDragOver={(event) => {
                if (editing) {
                  return;
                }

                event.preventDefault();
                setHoveredSlot(slot.position);
              }}
              onDragLeave={() => {
                if (!editing) {
                  setHoveredSlot((current) =>
                    current === slot.position ? null : current,
                  );
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                setHoveredSlot(null);

                const raw =
                  event.dataTransfer.getData("application/json") ||
                  event.dataTransfer.getData("text/plain");

                if (!raw) {
                  return;
                }

                try {
                  const participant = JSON.parse(raw) as DragParticipantPayload;
                  const playerName =
                    participant.name?.trim() || participant.userId?.trim();

                  if (!playerName) {
                    toast.error("Invalid participant for drag and drop.");
                    return;
                  }

                  // If className is already a known RoleKey (set by role override),
                  // use it directly instead of trying to resolve from weapon names.
                  const resolvedRole =
                    participant.className && participant.className in ROLE_META
                      ? (participant.className as RoleKey)
                      : resolveParticipantRole(participant);

                  onDropParticipant({
                    rosterIndex,
                    groupNumber: group.groupNumber,
                    slotPosition: slot.position,
                    playerName,
                    role: resolvedRole,
                  });
                } catch {
                  toast.error("Unable to read dragged participant.");
                }
              }}
              onClick={() => {
                if (isEmpty && !editing) {
                  startSlotEdit(slot);
                }
              }}
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                <RoleIcon role={displayRole ?? null} />
              </div>

              <span
                className={`min-w-0 flex-1 truncate text-xs ${
                  isEmpty
                    ? "italic text-slate-600"
                    : isMercenary
                      ? "text-amber-300"
                      : "text-slate-200"
                }`}
              >
                {isPendingDrop
                  ? "Assigning..."
                  : isEmpty
                    ? "Empty"
                    : displayPlayer}
              </span>

              {!isEmpty ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    startSlotEdit(slot);
                  }}
                  disabled={pending || isPendingDrop}
                  className="shrink-0 text-[10px] text-slate-500 transition-colors hover:text-sky-300 disabled:opacity-40"
                  aria-label="Edit player"
                  title="Edit name / role"
                >
                  <FontAwesomeIcon icon={faPencil} className="h-2.5 w-2.5" />
                </button>
              ) : null}
              {!isEmpty ? (
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();

                    const currentName = slot.playerName;
                    const nextName = isMercenary
                      ? stripMercenaryPrefix(currentName)
                      : withMercenaryPrefix(currentName);

                    if (!nextName) {
                      return;
                    }

                    setPending(true);
                    try {
                      const currentData = queryClient.getQueryData([
                        "roster",
                        sessionId,
                      ]) as RosterResponse | undefined;

                      if (currentData) {
                        const updatedGroups =
                          rosterIndex === 1
                            ? currentData.roster.groups.map((g) =>
                                g.groupNumber === group.groupNumber
                                  ? {
                                      ...g,
                                      slots: g.slots.map((s) =>
                                        s.position === slot.position
                                          ? { ...s, playerName: nextName }
                                          : s,
                                      ),
                                    }
                                  : g,
                              )
                            : currentData.roster.groups;

                        const updatedSecondGroups =
                          rosterIndex === 2
                            ? currentData.roster.secondGroups.map((g) =>
                                g.groupNumber === group.groupNumber
                                  ? {
                                      ...g,
                                      slots: g.slots.map((s) =>
                                        s.position === slot.position
                                          ? { ...s, playerName: nextName }
                                          : s,
                                      ),
                                    }
                                  : g,
                              )
                            : currentData.roster.secondGroups;

                        queryClient.setQueryData(["roster", sessionId], {
                          ...currentData,
                          roster: {
                            ...currentData.roster,
                            groups: updatedGroups,
                            secondGroups: updatedSecondGroups,
                          },
                        });
                      }

                      await updateSlot({
                        sessionId: sessionId ?? undefined,
                        rosterIndex,
                        groupNumber: group.groupNumber,
                        slotPosition: slot.position,
                        playerName: nextName,
                        role: slot.role,
                      });

                      void queryClient.invalidateQueries({
                        queryKey: ["roster", sessionId],
                      });
                      toast.success(
                        isMercenary
                          ? "Mercenary removed."
                          : "Marked as mercenary.",
                      );
                    } catch (error) {
                      void queryClient.invalidateQueries({
                        queryKey: ["roster", sessionId],
                      });
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Unknown error.",
                      );
                    } finally {
                      setPending(false);
                    }
                  }}
                  className={`shrink-0 rounded px-1 py-0 text-[9px] font-bold uppercase transition ${
                    isMercenary
                      ? "bg-amber-500/30 text-amber-400 hover:bg-amber-500/50"
                      : "bg-slate-800 text-slate-600 hover:bg-slate-700 hover:text-slate-400"
                  }`}
                  title="Toggle mercenary"
                >
                  M
                </button>
              ) : null}
              {!isEmpty ? (
                <button
                  type="button"
                  onClick={async () => {
                    setPending(true);
                    try {
                      // Optimistic update: remove player immediately
                      const currentData = queryClient.getQueryData([
                        "roster",
                        sessionId,
                      ]) as RosterResponse | undefined;
                      if (currentData) {
                        const updatedGroups =
                          rosterIndex === 1
                            ? currentData.roster.groups.map((g) =>
                                g.groupNumber === group.groupNumber
                                  ? {
                                      ...g,
                                      slots: g.slots.map((s) =>
                                        s.position === slot.position
                                          ? {
                                              ...s,
                                              playerName: null,
                                              role: null,
                                            }
                                          : s,
                                      ),
                                    }
                                  : g,
                              )
                            : currentData.roster.groups;

                        const updatedSecondGroups =
                          rosterIndex === 2
                            ? currentData.roster.secondGroups.map((g) =>
                                g.groupNumber === group.groupNumber
                                  ? {
                                      ...g,
                                      slots: g.slots.map((s) =>
                                        s.position === slot.position
                                          ? {
                                              ...s,
                                              playerName: null,
                                              role: null,
                                            }
                                          : s,
                                      ),
                                    }
                                  : g,
                              )
                            : currentData.roster.secondGroups;

                        const updatedData: RosterResponse = {
                          ...currentData,
                          roster: {
                            ...currentData.roster,
                            groups: updatedGroups,
                            secondGroups: updatedSecondGroups,
                          },
                        };
                        queryClient.setQueryData(
                          ["roster", sessionId],
                          updatedData,
                        );
                      }

                      // Send to server with lightweight endpoint
                      await updateSlot({
                        sessionId: sessionId ?? undefined,
                        rosterIndex,
                        groupNumber: group.groupNumber,
                        slotPosition: slot.position,
                        playerName: null,
                        role: null,
                      });

                      // Sync in background without blocking the UI.
                      void queryClient.invalidateQueries({
                        queryKey: ["roster", sessionId],
                      });

                      toast.success("Player removed from roster.");
                    } catch (error) {
                      queryClient.invalidateQueries({
                        queryKey: ["roster", sessionId],
                      });
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Unknown error.",
                      );
                    } finally {
                      setPending(false);
                    }
                  }}
                  disabled={pending || isPendingDrop}
                  className="text-[10px] text-slate-500 transition-colors hover:text-rose-300 disabled:opacity-40"
                  aria-label="Remove player"
                  title="Remove player"
                >
                  <FontAwesomeIcon icon={faXmark} className="h-2.5 w-2.5" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── RosterCard ────────────────────────────────────────────────────────────────

export function RosterCard() {
  const queryClient = useQueryClient();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedImportFilterPreset, setSelectedImportFilterPreset] =
    useState<RaidHelperImportFilterPreset>("classic");
  const [isRefreshingRaidHelper, setIsRefreshingRaidHelper] =
    useState<boolean>(false);
  const [pendingDropTarget, setPendingDropTarget] = useState<string | null>(
    null,
  );
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [roleOverrides, setRoleOverrides] = useState<Record<string, RoleKey>>(
    {},
  );
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>(
    {},
  );
  const [factionOverrides, setFactionOverrides] = useState<
    Record<string, string>
  >({});
  const [specOverrides, setSpecOverrides] = useState<Record<string, string>>(
    {},
  );
  const [mercFlags, setMercFlags] = useState<Record<string, boolean>>({});
  const [pendingResetKeys, setPendingResetKeys] = useState<
    Record<string, true>
  >({});
  const [editingNameKey, setEditingNameKey] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");

  const sessionsQuery = useQuery({
    queryKey: ["roster-sessions"],
    queryFn: fetchRosterSessions,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["roster", activeSessionId],
    queryFn: () => fetchRoster(activeSessionId),
    staleTime: 2 * 60 * 1000, // Keep data fresh for 2 minutes
    refetchOnWindowFocus: false, // Disabled since we use optimistic updates
    refetchOnReconnect: true, // Only refetch if connection is restored
    refetchOnMount: false,
  });

  const eventsQuery = useQuery({
    queryKey: ["raid-helper-events", activeSessionId],
    queryFn: () => fetchRaidHelperEvents(activeSessionId),
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const participantsQuery = useQuery({
    queryKey: [
      "raid-helper-event-participants",
      activeSessionId,
      selectedEventId,
    ],
    queryFn: () =>
      fetchRaidHelperParticipants(activeSessionId, selectedEventId),
    enabled: Boolean(activeSessionId && selectedEventId),
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const selectedEventMutation = useMutation({
    mutationFn: (eventId: string | null) =>
      saveSelectedEventId(activeSessionId, eventId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["roster", activeSessionId], updated);
      setSelectedEventId(updated.roster.selectedEventId ?? "");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unknown error.");
    },
  });

  const selectedImportFilterPresetMutation = useMutation({
    mutationFn: (preset: RaidHelperImportFilterPreset) =>
      saveSelectedImportFilterPreset(activeSessionId, preset),
    onSuccess: (updated) => {
      queryClient.setQueryData(["roster", activeSessionId], updated);
      setSelectedImportFilterPreset(updated.roster.selectedImportFilterPreset);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unknown error.");
    },
  });

  const selectedPlayerSearchQueryMutation = useMutation({
    mutationFn: (query: string) =>
      saveSelectedPlayerSearchQuery(activeSessionId, query),
    onSuccess: (updated) => {
      queryClient.setQueryData(["roster", activeSessionId], updated);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unknown error.");
    },
  });

  function handleGroupSaved(updated: RosterResponse) {
    queryClient.setQueryData(["roster", activeSessionId], updated);
  }

  const clearRosterMutation = useMutation({
    mutationFn: () => clearRoster(activeSessionId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["roster", activeSessionId], updated);
      toast.success("Roster cleared.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Unknown error.");
    },
  });

  const archiveRosterMutation = useMutation({
    mutationFn: () => archiveRosterForSession(activeSessionId),
    onSuccess: () => {
      toast.success("Roster archived successfully.");
      queryClient.invalidateQueries({ queryKey: ["roster-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["roster", activeSessionId] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Unknown error.");
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: (name?: string) => createRosterSession(name),
    onSuccess: (created) => {
      setActiveSessionId(created.id);
      queryClient.invalidateQueries({ queryKey: ["roster-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["roster", created.id] });
      toast.success("Roster session created.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Unknown error.");
    },
  });

  const lockSessionMutation = useMutation({
    mutationFn: (nextLocked: boolean) => {
      if (!activeSessionId) throw new Error("No roster session selected.");
      return updateRosterSession(activeSessionId, { isLocked: nextLocked });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roster-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["roster", activeSessionId] });
      toast.success("Session updated.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Unknown error.");
    },
  });

  const renameSessionMutation = useMutation({
    mutationFn: (name: string | null) => {
      if (!activeSessionId) throw new Error("No roster session selected.");
      return updateRosterSession(activeSessionId, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roster-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["roster", activeSessionId] });
      toast.success("Session renamed.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Unknown error.");
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: () => {
      if (!activeSessionId) throw new Error("No roster session selected.");
      return deleteRosterSession(activeSessionId);
    },
    onSuccess: () => {
      setActiveSessionId(null);
      queryClient.invalidateQueries({ queryKey: ["roster-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["roster"] });
      toast.success("Session deleted.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Unknown error.");
    },
  });

  const shareSessionMutation = useMutation({
    mutationFn: async () => {
      if (!activeSessionId) throw new Error("No roster session selected.");
      const response = await createRosterShareLink(activeSessionId);
      await navigator.clipboard.writeText(response.shareUrl);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roster-sessions"] });
      toast.success("Share link copied to clipboard.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Unknown error.");
    },
  });

  const disableShareMutation = useMutation({
    mutationFn: async () => {
      if (!activeSessionId) throw new Error("No roster session selected.");
      await deleteRosterShareLink(activeSessionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roster-sessions"] });
      toast.success("Share link disabled.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Unknown error.");
    },
  });

  async function handleRefreshRaidHelper() {
    try {
      setIsRefreshingRaidHelper(true);

      const refreshedEvents = await fetchRaidHelperEventsWithMode(
        activeSessionId,
        true,
      );
      queryClient.setQueryData(
        ["raid-helper-events", activeSessionId],
        refreshedEvents,
      );

      if (selectedEventId) {
        const refreshedParticipants = await fetchRaidHelperParticipantsWithMode(
          activeSessionId,
          selectedEventId,
          true,
        );
        queryClient.setQueryData(
          ["raid-helper-event-participants", activeSessionId, selectedEventId],
          refreshedParticipants,
        );
      }

      toast.success("RaidHelper list refreshed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unknown error.");
    } finally {
      setIsRefreshingRaidHelper(false);
    }
  }

  function handleImportFilterPresetChange(
    nextPreset: RaidHelperImportFilterPreset,
  ) {
    setSelectedImportFilterPreset(nextPreset);
    selectedImportFilterPresetMutation.mutate(nextPreset);
  }

  useEffect(() => {
    if (activeSessionId) {
      return;
    }

    const firstSession = sessionsQuery.data?.[0];
    if (firstSession?.id) {
      setActiveSessionId(firstSession.id);
    }
  }, [activeSessionId, sessionsQuery.data]);

  useEffect(() => {
    if (data?.rosterSession?.id && data.rosterSession.id !== activeSessionId) {
      setActiveSessionId(data.rosterSession.id);
    }
  }, [activeSessionId, data?.rosterSession?.id]);

  useEffect(() => {
    const persistedPreset =
      data?.roster.selectedImportFilterPreset ?? "classic";

    if (persistedPreset !== selectedImportFilterPreset) {
      setSelectedImportFilterPreset(persistedPreset);
    }
  }, [data?.roster.selectedImportFilterPreset, selectedImportFilterPreset]);

  useEffect(() => {
    if (!activeSessionId || data?.rosterSession.id !== activeSessionId) {
      return;
    }

    const persistedSearchQuery = data.roster.playerSearchQuery ?? "";

    if (persistedSearchQuery !== playerSearch) {
      setPlayerSearch(persistedSearchQuery);
    }
  }, [
    activeSessionId,
    data?.roster.playerSearchQuery,
    data?.rosterSession.id,
    playerSearch,
  ]);

  useEffect(() => {
    if (!activeSessionId || data?.rosterSession.id !== activeSessionId) {
      return;
    }

    const persistedSearchQuery = data.roster.playerSearchQuery ?? "";

    if (playerSearch === persistedSearchQuery) {
      return;
    }

    const timeout = window.setTimeout(() => {
      selectedPlayerSearchQueryMutation.mutate(playerSearch);
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    activeSessionId,
    data?.roster.playerSearchQuery,
    data?.rosterSession.id,
    playerSearch,
    selectedPlayerSearchQueryMutation,
  ]);

  useEffect(() => {
    const events = eventsQuery.data?.events;
    const persistedEventId = data?.roster.selectedEventId ?? "";

    if (!events) {
      return;
    }

    if (
      persistedEventId &&
      events.some((event) => event.id === persistedEventId)
    ) {
      if (selectedEventId !== persistedEventId) {
        setSelectedEventId(persistedEventId);
      }
      return;
    }

    if (
      selectedEventId &&
      !events.some((event) => event.id === selectedEventId)
    ) {
      setSelectedEventId("");
    }
  }, [
    data?.roster.selectedEventId,
    eventsQuery.data?.events,
    selectedEventId,
    activeSessionId,
  ]);

  // ── Participant overrides (global via API) ─────────────────────────────────
  const guildId = data?.guild.id ?? null;

  const overridesQuery = useQuery({
    queryKey: [
      "participant-overrides",
      guildId,
      activeSessionId,
      selectedEventId,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ eventId: selectedEventId });
      if (activeSessionId) {
        params.set("sessionId", activeSessionId);
      }
      const res = await fetch(
        `/api/roster/participant-overrides?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load overrides");
      const json = (await res.json()) as {
        overrides: {
          participantKey: string;
          nameOverride: string | null;
          roleOverride: string | null;
          isMerc: boolean;
        }[];
      };
      const roleOv: Record<string, RoleKey> = {};
      const nameOv: Record<string, string> = {};
      const factionOv: Record<string, string> = {};
      const specOv: Record<string, string> = {};
      const mercOv: Record<string, boolean> = {};
      for (const o of json.overrides) {
        if (o.roleOverride) {
          const eunaOverride = parseEunaOverrideToken(o.roleOverride);
          if (eunaOverride) {
            if (eunaOverride.factionOverride) {
              factionOv[o.participantKey] = eunaOverride.factionOverride;
            }
            if (eunaOverride.specOverride) {
              specOv[o.participantKey] = eunaOverride.specOverride;
            }
          } else {
            roleOv[o.participantKey] = o.roleOverride as RoleKey;
          }
        }
        if (o.nameOverride) nameOv[o.participantKey] = o.nameOverride;
        if (o.isMerc) mercOv[o.participantKey] = true;
      }
      return { roleOv, nameOv, factionOv, specOv, mercOv };
    },
    enabled: Boolean(guildId && activeSessionId && selectedEventId),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Sync fetched overrides into local state
  useEffect(() => {
    if (!overridesQuery.data) return;
    setRoleOverrides(overridesQuery.data.roleOv);
    setNameOverrides(overridesQuery.data.nameOv);
    setFactionOverrides(overridesQuery.data.factionOv);
    setSpecOverrides(overridesQuery.data.specOv);
    setMercFlags(overridesQuery.data.mercOv);
    setPendingResetKeys({});
  }, [overridesQuery.data]);

  // Reset overrides when event changes
  useEffect(() => {
    if (!selectedEventId) {
      setRoleOverrides({});
      setNameOverrides({});
      setFactionOverrides({});
      setSpecOverrides({});
      setMercFlags({});
      setPendingResetKeys({});
    }
  }, [selectedEventId]);

  // Debounced save: push all overrides to API 500ms after last change
  useEffect(() => {
    if (!guildId || !activeSessionId || !selectedEventId) return;
    const timer = setTimeout(async () => {
      const allKeys = new Set([
        ...Object.keys(roleOverrides),
        ...Object.keys(nameOverrides),
        ...Object.keys(factionOverrides),
        ...Object.keys(specOverrides),
        ...Object.keys(mercFlags),
        ...Object.keys(pendingResetKeys),
      ]);
      const overrides = Array.from(allKeys).map((k) => {
        const mustReset = Boolean(pendingResetKeys[k]);
        const eunaRoleOverrideToken = buildEunaOverrideToken(
          factionOverrides[k],
          specOverrides[k],
        );
        return {
          participantKey: k,
          nameOverride: mustReset ? null : (nameOverrides[k] ?? null),
          roleOverride: mustReset
            ? null
            : (eunaRoleOverrideToken ?? roleOverrides[k] ?? null),
          isMerc: mustReset ? false : (mercFlags[k] ?? false),
        };
      });
      try {
        await fetch("/api/roster/participant-overrides", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: selectedEventId,
            sessionId: activeSessionId,
            overrides,
          }),
        });
        if (Object.keys(pendingResetKeys).length > 0) {
          setPendingResetKeys({});
        }
      } catch {
        // silent fail — overrides are non-critical
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [
    guildId,
    activeSessionId,
    selectedEventId,
    roleOverrides,
    nameOverrides,
    factionOverrides,
    specOverrides,
    mercFlags,
    pendingResetKeys,
  ]);

  function markParticipantOverridesReset(participantKey: string) {
    setNameOverrides((prev) => {
      const next = { ...prev };
      delete next[participantKey];
      return next;
    });
    setRoleOverrides((prev) => {
      const next = { ...prev };
      delete next[participantKey];
      return next;
    });
    setFactionOverrides((prev) => {
      const next = { ...prev };
      delete next[participantKey];
      return next;
    });
    setSpecOverrides((prev) => {
      const next = { ...prev };
      delete next[participantKey];
      return next;
    });
    setMercFlags((prev) => {
      const next = { ...prev };
      delete next[participantKey];
      return next;
    });
    setPendingResetKeys((prev) => ({
      ...prev,
      [participantKey]: true,
    }));
  }

  function resetAllEventOverrides() {
    const keys = new Set([
      ...Object.keys(roleOverrides),
      ...Object.keys(nameOverrides),
      ...Object.keys(factionOverrides),
      ...Object.keys(specOverrides),
      ...Object.keys(mercFlags),
    ]);

    if (keys.size === 0) {
      return;
    }

    setRoleOverrides({});
    setNameOverrides({});
    setFactionOverrides({});
    setSpecOverrides({});
    setMercFlags({});
    setPendingResetKeys((prev) => {
      const next = { ...prev };
      for (const key of keys) {
        next[key] = true;
      }
      return next;
    });
    toast.success("All participant overrides reset for this event.");
  }

  useEffect(() => {
    const source = new EventSource("/api/live-updates");

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          topic?: string;
        };

        if (payload.type === "update" && payload.topic === "roster") {
          queryClient.invalidateQueries({ queryKey: ["roster"] });
          queryClient.invalidateQueries({
            queryKey: ["participant-overrides"],
          });
          queryClient.invalidateQueries({ queryKey: ["roster-sessions"] });
        }
      } catch {
        // Ignore malformed SSE messages.
      }
    };

    return () => {
      source.close();
    };
  }, [queryClient]);

  async function handleParticipantDrop(input: {
    rosterIndex: 1 | 2;
    groupNumber: number;
    slotPosition: number;
    playerName: string;
    role?: string | null;
  }) {
    const sourceGroups =
      input.rosterIndex === 2
        ? (data?.roster.secondGroups ?? [])
        : (data?.roster.groups ?? []);

    const targetGroup = sourceGroups.find(
      (group) => group.groupNumber === input.groupNumber,
    );

    if (!targetGroup) {
      toast.error("Group not found.");
      return;
    }

    setPendingDropTarget(
      `${input.rosterIndex}-${input.groupNumber}-${input.slotPosition}`,
    );

    try {
      // Optimistic update
      const currentData = queryClient.getQueryData([
        "roster",
        activeSessionId,
      ]) as RosterResponse | undefined;
      if (currentData) {
        const updatedGroups =
          input.rosterIndex === 1
            ? currentData.roster.groups.map((g) =>
                g.groupNumber === input.groupNumber
                  ? {
                      ...g,
                      slots: g.slots.map((s) =>
                        s.position === input.slotPosition
                          ? {
                              ...s,
                              playerName: input.playerName,
                              role: input.role ?? s.role,
                            }
                          : s,
                      ),
                    }
                  : g,
              )
            : currentData.roster.groups;

        const updatedSecondGroups =
          input.rosterIndex === 2
            ? currentData.roster.secondGroups.map((g) =>
                g.groupNumber === input.groupNumber
                  ? {
                      ...g,
                      slots: g.slots.map((s) =>
                        s.position === input.slotPosition
                          ? {
                              ...s,
                              playerName: input.playerName,
                              role: input.role ?? s.role,
                            }
                          : s,
                      ),
                    }
                  : g,
              )
            : currentData.roster.secondGroups;

        const updatedData: RosterResponse = {
          ...currentData,
          roster: {
            ...currentData.roster,
            groups: updatedGroups,
            secondGroups: updatedSecondGroups,
          },
        };
        queryClient.setQueryData(["roster", activeSessionId], updatedData);
      }

      // Send to server with lightweight endpoint
      await updateSlot({
        sessionId: activeSessionId ?? undefined,
        rosterIndex: input.rosterIndex,
        groupNumber: input.groupNumber,
        slotPosition: input.slotPosition,
        playerName: input.playerName,
        role: input.role ?? null,
      });

      // Sync in background without blocking the UI.
      void queryClient.invalidateQueries({
        queryKey: ["roster", activeSessionId],
      });

      toast.success(
        `Player assigned to roster ${input.rosterIndex}, group ${input.groupNumber}.`,
      );
    } catch (error) {
      // Refetch to restore correct state
      queryClient.invalidateQueries({ queryKey: ["roster", activeSessionId] });
      toast.error(error instanceof Error ? error.message : "Unknown error.");
    } finally {
      setPendingDropTarget(null);
    }
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-300">
        {error instanceof Error ? error.message : "Unable to load roster."}
      </div>
    );
  }

  const groups = data?.roster.groups ?? [];
  const secondGroups = data?.roster.secondGroups ?? [];
  const enableSecondRoster = data?.roster.enableSecondRoster ?? false;

  const row1 = groups.slice(0, 5);
  const row2 = groups.slice(5, 10);
  const secondRow1 = secondGroups.slice(0, 5);
  const secondRow2 = secondGroups.slice(5, 10);

  const assignedPlayerNames = new Set(
    [...groups, ...(enableSecondRoster ? secondGroups : [])].flatMap((g) =>
      g.slots.map((s) => s.playerName).filter(Boolean),
    ) as string[],
  );

  const searchQuery = playerSearch.trim().toLowerCase();

  function resolveEffectiveEunaParticipant(
    participant: RaidHelperParticipant,
    participantKey: string,
  ): RaidHelperParticipant {
    const factionOverride = factionOverrides[participantKey];
    const specOverride = specOverrides[participantKey];

    const effectiveFaction =
      factionOverride ?? normalizeRoleToken(participant.className) ?? null;
    const effectiveSpec = specOverride
      ? (EUNA_SPEC_LABELS[specOverride] ?? specOverride)
      : (participant.specName ?? null);

    return {
      ...participant,
      className: effectiveFaction,
      specName: effectiveSpec,
    };
  }

  const sortedParticipants = [...(participantsQuery.data?.participants ?? [])]
    .filter((p) => {
      const key = p.name?.trim() || p.userId?.trim();
      if (key && assignedPlayerNames.has(key)) return false;
      if (!shouldIncludeParticipantByPreset(p, selectedImportFilterPreset)) {
        return false;
      }
      if (searchQuery) {
        const name = (p.name ?? p.userId ?? "").toLowerCase();
        return name.includes(searchQuery);
      }
      return true;
    })
    .sort((a, b) => {
      const keyA = a.userId ?? a.name ?? "";
      const keyB = b.userId ?? b.name ?? "";
      const effectiveA =
        selectedImportFilterPreset === "euna"
          ? resolveEffectiveEunaParticipant(a, keyA)
          : a;
      const effectiveB =
        selectedImportFilterPreset === "euna"
          ? resolveEffectiveEunaParticipant(b, keyB)
          : b;
      const roleA = resolveParticipantRoleByPreset(
        effectiveA,
        selectedImportFilterPreset,
      );
      const roleB = resolveParticipantRoleByPreset(
        effectiveB,
        selectedImportFilterPreset,
      );
      const priorityA = roleA ? (ROLE_SORT_PRIORITY[roleA] ?? 99) : 99;
      const priorityB = roleB ? (ROLE_SORT_PRIORITY[roleB] ?? 99) : 99;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      const nameA = (a.name ?? "").toLowerCase();
      const nameB = (b.name ?? "").toLowerCase();
      return nameA.localeCompare(nameB, "en");
    });

  const mercPlayersCount = Object.values(mercFlags).filter(Boolean).length;

  const allParticipants = participantsQuery.data?.participants ?? [];
  const totalParticipantsCount = allParticipants.length;
  const roleCounts: Partial<Record<string, number>> = {};
  const eunaSpecCounts: Partial<Record<string, number>> = {};

  for (const participant of allParticipants) {
    const participantKey = participant.userId ?? participant.name ?? "";
    const effectiveParticipant =
      selectedImportFilterPreset === "euna"
        ? resolveEffectiveEunaParticipant(participant, participantKey)
        : participant;

    if (selectedImportFilterPreset === "euna") {
      const specToken = normalizeCompactToken(effectiveParticipant.specName);
      if (specToken && specToken in EUNA_SPEC_TO_ROLE) {
        eunaSpecCounts[specToken] = (eunaSpecCounts[specToken] ?? 0) + 1;
      }
    }

    const role =
      resolveParticipantRoleByPreset(
        effectiveParticipant,
        selectedImportFilterPreset,
      ) ?? "__none";
    roleCounts[role] = (roleCounts[role] ?? 0) + 1;
  }

  const participantRoleBadges: ParticipantCountBadge[] =
    selectedImportFilterPreset === "euna"
      ? Object.keys(EUNA_SPEC_TO_ROLE)
          .filter((specKey) => (eunaSpecCounts[specKey] ?? 0) > 0)
          .map((specKey) => {
            const mappedRole = EUNA_SPEC_TO_ROLE[specKey];
            const isCrescentWave = specKey === "crescentwave";
            const mappedMeta =
              mappedRole && mappedRole in ROLE_META
                ? ROLE_META[mappedRole]
                : null;

            return {
              key: specKey,
              count: eunaSpecCounts[specKey] ?? 0,
              icon: isCrescentWave ? faKhanda : (mappedMeta?.icon ?? faUser),
              color: isCrescentWave
                ? "text-cyan-400"
                : (mappedMeta?.color ?? "text-slate-500"),
              label: EUNA_SPEC_LABELS[specKey] ?? specKey,
            };
          })
      : Object.keys(ROLE_META)
          .sort(
            (a, b) =>
              (ROLE_SORT_PRIORITY[a] ?? 99) - (ROLE_SORT_PRIORITY[b] ?? 99),
          )
          .filter((role) => (roleCounts[role] ?? 0) > 0)
          .map((role) => ({
            key: role,
            count: roleCounts[role] ?? 0,
            icon: ROLE_META[role].icon,
            color: ROLE_META[role].color,
            label: ROLE_META[role].label,
          }));

  const lastRefreshRaw = selectedEventId
    ? (participantsQuery.data?.participantsCachedAt ??
      eventsQuery.data?.eventsCachedAt ??
      null)
    : (eventsQuery.data?.eventsCachedAt ?? null);

  const lastRefreshDisplay = formatRefreshDateTime(lastRefreshRaw);
  const stale = isDataStale(lastRefreshRaw);
  const activeSession =
    sessionsQuery.data?.find((s) => s.id === activeSessionId) ?? null;
  const activeShareUrl = activeSession?.shares?.[0]?.shareUrl ?? null;
  const hasAnyEventOverride =
    Object.keys(roleOverrides).length > 0 ||
    Object.keys(nameOverrides).length > 0 ||
    Object.keys(factionOverrides).length > 0 ||
    Object.keys(specOverrides).length > 0 ||
    Object.keys(mercFlags).length > 0;

  function handleRenameSession() {
    if (!activeSessionId) {
      toast.error("No roster session selected.");
      return;
    }

    const currentName = activeSession?.name ?? "";
    const nextName = window.prompt("Rename session", currentName);

    if (nextName === null) {
      return;
    }

    renameSessionMutation.mutate(nextName.trim() || null);
  }

  function handleToggleLockSession() {
    lockSessionMutation.mutate(!Boolean(activeSession?.isLocked));
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/30 backdrop-blur">
      {/* ── Archive confirmation modal ─────────────────────────────────── */}
      {showArchiveConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100">
              Archive roster
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Current roster will be archived with all assigned players and the
              configured groups. You will be able to view it in the Archives
              tab.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowArchiveConfirm(false)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={archiveRosterMutation.isPending}
                onClick={() => {
                  setShowArchiveConfirm(false);
                  archiveRosterMutation.mutate();
                }}
                className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
              >
                {archiveRosterMutation.isPending ? (
                  <>
                    <LoadingIndicator /> Archiving...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faArchive} className="h-3 w-3" />
                    Archive
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Clear confirmation modal ──────────────────────────────────── */}
      {showClearConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100">
              Clear roster
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              All players assigned to groups will be removed. This action is
              irreversible.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearRosterMutation.isPending}
                onClick={() => {
                  setShowClearConfirm(false);
                  clearRosterMutation.mutate();
                }}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
              >
                {clearRosterMutation.isPending ? (
                  <>
                    <LoadingIndicator /> Clearing...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faTrash} className="h-3 w-3" />
                    Clear
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <h2 className="text-xl font-semibold text-slate-100">Roster</h2>

        <RosterSessionToolbar
          activeSessionId={activeSessionId}
          sessions={sessionsQuery.data ?? []}
          activeSession={activeSession}
          activeShareUrl={activeShareUrl}
          isCreatingSession={createSessionMutation.isPending}
          isRenamingSession={renameSessionMutation.isPending}
          isLockingSession={lockSessionMutation.isPending}
          isSharingSession={shareSessionMutation.isPending}
          isDisablingShare={disableShareMutation.isPending}
          isArchiving={archiveRosterMutation.isPending}
          isClearing={clearRosterMutation.isPending}
          isDeletingSession={deleteSessionMutation.isPending}
          onSelectSession={setActiveSessionId}
          onCreateSession={() => createSessionMutation.mutate(undefined)}
          onRenameSession={handleRenameSession}
          onToggleLockSession={handleToggleLockSession}
          onShareSession={() => shareSessionMutation.mutate()}
          onDisableShare={() => disableShareMutation.mutate()}
          onOpenArchiveConfirm={() => setShowArchiveConfirm(true)}
          onOpenClearConfirm={() => setShowClearConfirm(true)}
          onDeleteSession={() => deleteSessionMutation.mutate()}
        />
      </div>

      {/* ── Main layout: left = players, right = rosters ─────────────── */}
      <div className="mt-5 flex gap-4">
        {/* ── Left panel: event selector + player list ──────────────── */}
        <div className="w-64 shrink-0">
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <FontAwesomeIcon
                  icon={faCalendarDays}
                  className="h-4 w-4 shrink-0 text-sky-400"
                />
                <span className="text-sm font-medium text-slate-200">
                  RaidHelper Event
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleRefreshRaidHelper();
                }}
                disabled={eventsQuery.isFetching || isRefreshingRaidHelper}
                className="rounded border border-slate-700/60 px-1.5 py-1 text-slate-500 transition-colors hover:text-slate-300 disabled:opacity-40"
                aria-label="Refresh"
              >
                <FontAwesomeIcon
                  icon={faRotateRight}
                  className={`h-3 w-3 ${eventsQuery.isFetching || isRefreshingRaidHelper ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            {eventsQuery.isError ? (
              <p className="mt-2 text-xs text-amber-400">
                {eventsQuery.error instanceof Error
                  ? eventsQuery.error.message
                  : "Unable to load events."}
              </p>
            ) : eventsQuery.isLoading ? (
              <div className="mt-2">
                <InlineLoadingIndicator />
              </div>
            ) : (eventsQuery.data?.events.length ?? 0) === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                No event found in this channel.
              </p>
            ) : (
              <>
                <select
                  value={selectedEventId}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setSelectedEventId(nextValue);
                    selectedEventMutation.mutate(nextValue || null);
                  }}
                  disabled={selectedEventMutation.isPending}
                  className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                >
                  <option value="">-- Select an event --</option>
                  {eventsQuery.data?.events.map((event) => {
                    const date = new Date(event.startTime * 1000);
                    const label = `${date.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" })} ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} — ${event.title}`;
                    return (
                      <option key={event.id} value={event.id}>
                        {label}
                      </option>
                    );
                  })}
                </select>

                <select
                  value={selectedImportFilterPreset}
                  onChange={(e) =>
                    handleImportFilterPresetChange(
                      e.target.value as RaidHelperImportFilterPreset,
                    )
                  }
                  disabled={selectedImportFilterPresetMutation.isPending}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                >
                  <option value="classic">Classic</option>
                  <option value="euna">EUNA</option>
                </select>
              </>
            )}

            <div
              className={`mt-3 flex items-center justify-between rounded-md border px-3 py-2 text-xs transition-colors ${
                lastRefreshRaw === null
                  ? "border-slate-700/40 bg-slate-900/40 text-slate-500"
                  : stale
                    ? "border-amber-500/30 bg-amber-500/5 text-amber-400"
                    : "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
              }`}
            >
              <span className="font-medium tracking-wide">Last sync</span>
              <span
                className={`${
                  lastRefreshRaw === null
                    ? "text-slate-500"
                    : stale
                      ? "text-amber-200"
                      : "text-emerald-200"
                }`}
              >
                {lastRefreshDisplay}
              </span>
            </div>
          </div>

          {/* Player list */}
          {selectedEventId ? (
            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40">
              <div className="border-b border-slate-800 px-3 py-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Players ({totalParticipantsCount})
                </h3>
                <div className="flex items-center gap-2">
                  {mercPlayersCount > 0 && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                      {mercPlayersCount} mercs
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={resetAllEventOverrides}
                    disabled={!hasAnyEventOverride}
                    className="rounded border border-slate-700/70 px-2 py-0.5 text-[10px] font-medium text-slate-300 transition hover:border-sky-500/60 hover:text-sky-300 disabled:opacity-40"
                    title="Reset all participant overrides for this event"
                  >
                    Reset All Overrides
                  </button>
                </div>
              </div>

              {/* Role counts */}
              {participantsQuery.isLoading ? null : participantsQuery.isError ? null : (participantsQuery
                  .data?.participants.length ?? 0) ===
                0 ? null : participantRoleBadges.length === 0 ? null : (
                <div className="flex flex-wrap gap-1.5 border-b border-slate-800 px-3 py-2">
                  {participantRoleBadges.map(
                    ({ key, count, icon, color, label }) => (
                      <span
                        key={key}
                        className="flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-900/60 px-2 py-0.5 text-xs font-medium"
                      >
                        <FontAwesomeIcon
                          icon={icon}
                          className={`h-2.5 w-2.5 ${color}`}
                        />
                        <span className="text-slate-100 tabular-nums">
                          {count}
                        </span>
                        {selectedImportFilterPreset === "euna" ? (
                          <span className="text-[10px] text-slate-300">
                            {label}
                          </span>
                        ) : null}
                      </span>
                    ),
                  )}
                </div>
              )}

              {participantsQuery.isLoading ? (
                <div className="px-3 py-2">
                  <InlineLoadingIndicator />
                </div>
              ) : participantsQuery.isError ? (
                <p className="px-3 py-3 text-sm text-amber-400">
                  {participantsQuery.error instanceof Error
                    ? participantsQuery.error.message
                    : "Unable to load participants."}
                </p>
              ) : (participantsQuery.data?.participants.length ?? 0) === 0 ? (
                <p className="px-3 py-3 text-sm text-slate-500">
                  No usable participant found for this event.
                </p>
              ) : (
                <>
                  {/* Search input */}
                  <div className="border-b border-slate-800 px-2 py-2">
                    <input
                      type="text"
                      value={playerSearch}
                      onChange={(e) => setPlayerSearch(e.target.value)}
                      placeholder="Search player..."
                      className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500 placeholder:text-slate-500"
                    />
                  </div>
                  <div className="flex max-h-[calc(100vh-360px)] flex-col gap-1 overflow-auto p-2">
                    {sortedParticipants.length === 0 ? (
                      <p className="px-1 py-2 text-xs text-slate-500">
                        No player found.
                      </p>
                    ) : (
                      sortedParticipants.map((participant, index) => {
                        const participantKey =
                          participant.userId ??
                          participant.name ??
                          `idx-${index}`;
                        const effectiveParticipant =
                          selectedImportFilterPreset === "euna"
                            ? resolveEffectiveEunaParticipant(
                                participant,
                                participantKey,
                              )
                            : participant;
                        const eunaFaction =
                          resolveParticipantFactionEuna(effectiveParticipant);
                        const resolvedRole = resolveParticipantRoleByPreset(
                          effectiveParticipant,
                          selectedImportFilterPreset,
                        );
                        const overriddenRole =
                          selectedImportFilterPreset !== "euna" &&
                          participantKey in roleOverrides
                            ? roleOverrides[participantKey]
                            : resolvedRole;
                        const displayName =
                          nameOverrides[participantKey] ??
                          participant.name ??
                          "No name";
                        const hasFactionOverride =
                          participantKey in factionOverrides;
                        const hasSpecOverride = participantKey in specOverrides;
                        const hasAnyPlayerOverride =
                          participantKey in nameOverrides ||
                          participantKey in roleOverrides ||
                          hasFactionOverride ||
                          hasSpecOverride ||
                          Boolean(mercFlags[participantKey]) ||
                          Boolean(pendingResetKeys[participantKey]);
                        const isMerc = !!mercFlags[participantKey];
                        const isEditingName = editingNameKey === participantKey;
                        return (
                          <div
                            key={`${participantKey}-${index}`}
                            draggable={!isEditingName}
                            title={`${displayName}${effectiveParticipant.className ? ` | ${effectiveParticipant.className}` : ""}${effectiveParticipant.specName ? ` | ${effectiveParticipant.specName}` : ""}`}
                            onDragStart={(event) => {
                              if (isEditingName) return;
                              const effectiveName = isMerc
                                ? `[M] ${displayName}`
                                : displayName;
                              const payload: DragParticipantPayload = {
                                name: effectiveName,
                                userId: participant.userId,
                                specName: overriddenRole
                                  ? null
                                  : effectiveParticipant.specName,
                                className:
                                  overriddenRole ??
                                  effectiveParticipant.className,
                              };
                              const serialized = JSON.stringify(payload);
                              event.dataTransfer.setData(
                                "application/json",
                                serialized,
                              );
                              event.dataTransfer.setData(
                                "text/plain",
                                serialized,
                              );
                              event.dataTransfer.effectAllowed = "copy";
                            }}
                            className={`flex flex-col gap-1 rounded-lg border bg-slate-900/80 px-2 py-1.5 transition hover:bg-slate-900 ${isMerc ? "border-amber-500/40 hover:border-amber-500/60" : "border-slate-800 hover:border-sky-500/40"} ${isEditingName ? "cursor-default" : "cursor-grab"}`}
                          >
                            {/* Row 1: icon + name + merc button */}
                            <div className="flex items-center gap-1.5">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-800">
                                <RoleIcon role={overriddenRole} />
                              </div>
                              {selectedImportFilterPreset === "euna" ? (
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-800">
                                  <FactionIcon faction={eunaFaction} />
                                </div>
                              ) : null}
                              {isEditingName ? (
                                <input
                                  autoFocus
                                  type="text"
                                  value={editingNameValue}
                                  onChange={(e) =>
                                    setEditingNameValue(e.target.value)
                                  }
                                  onBlur={() => {
                                    const trimmed = editingNameValue.trim();
                                    if (
                                      trimmed &&
                                      trimmed !== (participant.name ?? "")
                                    ) {
                                      setNameOverrides((prev) => ({
                                        ...prev,
                                        [participantKey]: trimmed,
                                      }));
                                    } else if (!trimmed) {
                                      setNameOverrides((prev) => {
                                        const next = { ...prev };
                                        delete next[participantKey];
                                        return next;
                                      });
                                    }
                                    setEditingNameKey(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      e.currentTarget.blur();
                                    if (e.key === "Escape") {
                                      setEditingNameKey(null);
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="min-w-0 flex-1 rounded border border-sky-500 bg-slate-800 px-1 py-0 text-xs font-medium text-slate-100 outline-none"
                                />
                              ) : (
                                <div
                                  className="min-w-0 flex-1 truncate text-xs font-medium text-slate-100 cursor-text"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingNameKey(participantKey);
                                    setEditingNameValue(
                                      displayName === "No name"
                                        ? ""
                                        : displayName,
                                    );
                                  }}
                                  title="Click to edit name"
                                >
                                  {displayName}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMercFlags((prev) => ({
                                    ...prev,
                                    [participantKey]: !prev[participantKey],
                                  }));
                                }}
                                className={`shrink-0 rounded px-1 py-0 text-[9px] font-bold uppercase transition ${isMerc ? "bg-amber-500/30 text-amber-400 hover:bg-amber-500/50" : "bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300"}`}
                                title="Toggle mercenary"
                              >
                                M
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markParticipantOverridesReset(participantKey);
                                }}
                                disabled={!hasAnyPlayerOverride}
                                className="shrink-0 rounded border border-slate-700/70 px-1 py-0 text-[9px] font-bold uppercase text-slate-400 transition hover:border-sky-500/60 hover:text-sky-300 disabled:opacity-40"
                                title="Reset all overrides for this player"
                              >
                                R
                              </button>
                            </div>
                            {/* Row 2: role select */}
                            {selectedImportFilterPreset === "euna" ? (
                              <div className="grid grid-cols-2 gap-1">
                                <select
                                  value={
                                    factionOverrides[participantKey] ??
                                    normalizeRoleToken(participant.className) ??
                                    ""
                                  }
                                  onChange={(e) => {
                                    const val = normalizeRoleToken(
                                      e.target.value,
                                    );
                                    setFactionOverrides((prev) => {
                                      const next = { ...prev };
                                      if (!val) {
                                        delete next[participantKey];
                                      } else {
                                        next[participantKey] = val;
                                      }
                                      return next;
                                    });
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full rounded border border-slate-700 bg-slate-800 py-0.5 pl-1 pr-4 text-[10px] text-slate-300 outline-none focus:border-sky-500"
                                >
                                  <option value="">Faction N/A</option>
                                  {EUNA_FACTION_OPTIONS.map((faction) => (
                                    <option key={faction} value={faction}>
                                      {formatFactionLabel(faction)}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={
                                    specOverrides[participantKey] ??
                                    normalizeCompactToken(
                                      participant.specName,
                                    ) ??
                                    ""
                                  }
                                  onChange={(e) => {
                                    const val = normalizeCompactToken(
                                      e.target.value,
                                    );
                                    setSpecOverrides((prev) => {
                                      const next = { ...prev };
                                      if (!val) {
                                        delete next[participantKey];
                                      } else {
                                        next[participantKey] = val;
                                      }
                                      return next;
                                    });
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full rounded border border-slate-700 bg-slate-800 py-0.5 pl-1 pr-4 text-[10px] text-slate-300 outline-none focus:border-sky-500"
                                >
                                  <option value="">Role N/A</option>
                                  {Object.entries(EUNA_SPEC_LABELS).map(
                                    ([specKey, specLabel]) => (
                                      <option key={specKey} value={specKey}>
                                        {specLabel}
                                      </option>
                                    ),
                                  )}
                                </select>
                              </div>
                            ) : (
                              <select
                                value={overriddenRole ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value as RoleKey;
                                  setRoleOverrides((prev) => ({
                                    ...prev,
                                    [participantKey]: val || null,
                                  }));
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full rounded border border-slate-700 bg-slate-800 py-0.5 pl-1 pr-4 text-[10px] text-slate-300 outline-none focus:border-sky-500"
                              >
                                <option value="">— role —</option>
                                {Object.entries(ROLE_META).map(
                                  ([key, meta]) => (
                                    <option key={key} value={key}>
                                      {meta.label}
                                    </option>
                                  ),
                                )}
                              </select>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>

        {/* ── Right panel: rosters ──────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {/* Roster 1 */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {enableSecondRoster ? "Roster 1" : "Roster"}
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {row1.map((group) => (
                <GroupCard
                  key={`r1-${group.groupNumber}`}
                  sessionId={activeSessionId}
                  rosterIndex={1}
                  group={group}
                  onSaved={handleGroupSaved}
                  onDropParticipant={handleParticipantDrop}
                  pendingDropTarget={pendingDropTarget}
                  queryClient={queryClient}
                />
              ))}
            </div>
            <div className="border-t border-slate-800/60" />
            <div className="grid grid-cols-5 gap-2">
              {row2.map((group) => (
                <GroupCard
                  key={`r1-${group.groupNumber}`}
                  sessionId={activeSessionId}
                  rosterIndex={1}
                  group={group}
                  onSaved={handleGroupSaved}
                  onDropParticipant={handleParticipantDrop}
                  pendingDropTarget={pendingDropTarget}
                  queryClient={queryClient}
                />
              ))}
            </div>
          </div>

          {/* Roster 2 */}
          {enableSecondRoster ? (
            <>
              <div className="border-t border-slate-700/60" />
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Roster 2
                </h3>
                <div className="grid grid-cols-5 gap-2">
                  {secondRow1.map((group) => (
                    <GroupCard
                      key={`r2-${group.groupNumber}`}
                      sessionId={activeSessionId}
                      rosterIndex={2}
                      group={group}
                      onSaved={handleGroupSaved}
                      onDropParticipant={handleParticipantDrop}
                      pendingDropTarget={pendingDropTarget}
                      queryClient={queryClient}
                    />
                  ))}
                </div>
                <div className="border-t border-slate-800/60" />
                <div className="grid grid-cols-5 gap-2">
                  {secondRow2.map((group) => (
                    <GroupCard
                      key={`r2-${group.groupNumber}`}
                      sessionId={activeSessionId}
                      rosterIndex={2}
                      group={group}
                      onSaved={handleGroupSaved}
                      onDropParticipant={handleParticipantDrop}
                      pendingDropTarget={pendingDropTarget}
                      queryClient={queryClient}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 border-t border-slate-800 pt-4">
        {selectedImportFilterPreset === "euna" ? (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              EUNA Legend
            </h4>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  Faction
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs font-medium text-slate-200">
                  <FactionIcon faction="syndicate" />
                  Syndicate
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  Faction
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs font-medium text-slate-200">
                  <FactionIcon faction="covenant" />
                  Covenant
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  Faction
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs font-medium text-slate-200">
                  <FactionIcon faction="marauder" />
                  Marauder
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  Fallback
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs font-medium text-slate-400">
                  <FactionIcon faction={null} />
                  <span>Faction N/A</span>
                  <span>•</span>
                  <RoleIcon role={null} />
                  <span>Role N/A</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(EUNA_SPEC_TO_ROLE).map(
                ([specKey, mappedRole]) => (
                  <span
                    key={specKey}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-700/70 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300"
                  >
                    <span className="text-slate-100">
                      {EUNA_SPEC_LABELS[specKey] ?? specKey}
                    </span>
                    {specKey === "crescentwave" ? (
                      <FontAwesomeIcon
                        icon={faKhanda}
                        className="h-3 w-3 text-cyan-400"
                      />
                    ) : (
                      <RoleIcon role={mappedRole} />
                    )}
                  </span>
                ),
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                <FontAwesomeIcon
                  icon={faShield}
                  className="h-3 w-3 text-blue-400"
                />
                Tank
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                <FontAwesomeIcon
                  icon={faHammer}
                  className="h-3 w-3 text-rose-400"
                />
                Bruiser
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                <FontAwesomeIcon
                  icon={faCrosshairs}
                  className="h-3 w-3 text-red-400"
                />
                DPS
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                <FontAwesomeIcon
                  icon={faPlus}
                  className="h-3 w-3 text-emerald-400"
                />
                Heal
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                <FontAwesomeIcon
                  icon={faBiohazard}
                  className="h-3 w-3 text-violet-400"
                />
                Debuff
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                <FontAwesomeIcon
                  icon={faBolt}
                  className="h-3 w-3 text-amber-400"
                />
                Dex
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                <FontAwesomeIcon
                  icon={faHourglassHalf}
                  className="h-3 w-3 text-yellow-400"
                />
                Late
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                <FontAwesomeIcon
                  icon={faCircleQuestion}
                  className="h-3 w-3 text-slate-400"
                />
                Tentative
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                <FontAwesomeIcon
                  icon={faMinus}
                  className="h-3 w-3 text-slate-500"
                />
                Bench
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                <FontAwesomeIcon
                  icon={faUser}
                  className="h-3 w-3 text-slate-600"
                />
                Unassigned
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
