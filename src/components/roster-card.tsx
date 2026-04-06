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
  roster: {
    selectedEventId: string | null;
    groups: RosterGroupData[];
  };
};

type PostGroupPayload = {
  guildId?: string;
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

function resolveParticipantRole(participant: RaidHelperParticipant): RoleKey {
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

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchRoster(): Promise<RosterResponse> {
  const res = await fetch("/api/roster", { credentials: "include" });
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

async function archiveRoster(): Promise<{
  success: boolean;
  archiveId: string;
}> {
  const res = await fetch("/api/roster/archive", {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "Unable to archive roster.");
  }

  return res.json() as Promise<{ success: boolean; archiveId: string }>;
}

async function clearRoster(): Promise<RosterResponse> {
  const res = await fetch("/api/roster", {
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
  selectedEventId: string | null,
): Promise<RosterResponse> {
  const res = await fetch("/api/roster", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ selectedEventId }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "Unable to save event.");
  }

  return res.json() as Promise<RosterResponse>;
}

async function fetchRaidHelperEvents(): Promise<RaidHelperEventsResponse> {
  return fetchRaidHelperEventsWithMode(false);
}

async function fetchRaidHelperEventsWithMode(
  forceRefresh: boolean,
): Promise<RaidHelperEventsResponse> {
  const suffix = forceRefresh ? "?refresh=1" : "";
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
  eventId: string,
): Promise<RaidHelperParticipantsResponse> {
  return fetchRaidHelperParticipantsWithMode(eventId, false);
}

async function fetchRaidHelperParticipantsWithMode(
  eventId: string,
  forceRefresh: boolean,
): Promise<RaidHelperParticipantsResponse> {
  const suffix = forceRefresh ? "&refresh=1" : "";
  const res = await fetch(
    `/api/raid-helper-events?eventId=${encodeURIComponent(eventId)}${suffix}`,
    {
      credentials: "include",
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "Unable to load RaidHelper participants.");
  }
  return res.json() as Promise<RaidHelperParticipantsResponse>;
}

// ─── GroupCard ─────────────────────────────────────────────────────────────────

function GroupCard({
  group,
  onSaved,
  onDropParticipant,
  pendingDropTarget,
}: {
  group: RosterGroupData;
  onSaved: (updated: RosterResponse) => void;
  onDropParticipant: (input: {
    groupNumber: number;
    slotPosition: number;
    playerName: string;
    role?: string | null;
  }) => void;
  pendingDropTarget: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [localName, setLocalName] = useState(group.name ?? "");

  function startEdit() {
    setLocalName(group.name ?? "");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function confirmEdit() {
    setPending(true);
    try {
      const payload: PostGroupPayload = {
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
          const displayRole = isEmpty ? null : (slot.role as RoleKey);
          const slotKey = `${group.groupNumber}-${slot.position}`;
          const isPendingDrop = pendingDropTarget === slotKey;
          const isHovered = hoveredSlot === slot.position;

          return (
            <div
              key={slot.position}
              className={`flex items-center gap-2 rounded-md px-1 transition ${
                !editing && (isHovered || isPendingDrop)
                  ? "bg-sky-500/10 outline outline-1 outline-sky-500/40"
                  : ""
              }`}
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

                  const resolvedRole = resolveParticipantRole(participant);

                  onDropParticipant({
                    groupNumber: group.groupNumber,
                    slotPosition: slot.position,
                    playerName,
                    role: resolvedRole,
                  });
                } catch {
                  toast.error("Unable to read dragged participant.");
                }
              }}
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                <RoleIcon role={displayRole ?? null} />
              </div>

              <span
                className={`min-w-0 flex-1 truncate text-xs ${
                  isEmpty ? "italic text-slate-600" : "text-slate-200"
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
                  onClick={async () => {
                    setPending(true);
                    try {
                      const data = await saveGroup({
                        groupNumber: group.groupNumber,
                        name: group.name,
                        slots: group.slots.map((currentSlot) => ({
                          position: currentSlot.position,
                          playerName:
                            currentSlot.position === slot.position
                              ? null
                              : currentSlot.playerName,
                          role:
                            currentSlot.position === slot.position
                              ? null
                              : currentSlot.role,
                        })),
                      });
                      onSaved(data);
                      toast.success("Player removed from roster.");
                    } catch (error) {
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
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [isRefreshingRaidHelper, setIsRefreshingRaidHelper] =
    useState<boolean>(false);
  const [pendingDropTarget, setPendingDropTarget] = useState<string | null>(
    null,
  );
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["roster"],
    queryFn: fetchRoster,
    refetchOnWindowFocus: true,
  });

  const eventsQuery = useQuery({
    queryKey: ["raid-helper-events"],
    queryFn: fetchRaidHelperEvents,
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const participantsQuery = useQuery({
    queryKey: ["raid-helper-event-participants", selectedEventId],
    queryFn: () => fetchRaidHelperParticipants(selectedEventId),
    enabled: Boolean(selectedEventId),
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const selectedEventMutation = useMutation({
    mutationFn: saveSelectedEventId,
    onSuccess: (updated) => {
      queryClient.setQueryData(["roster"], updated);
      setSelectedEventId(updated.roster.selectedEventId ?? "");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unknown error.");
    },
  });

  function handleGroupSaved(updated: RosterResponse) {
    queryClient.setQueryData(["roster"], updated);
  }

  const clearRosterMutation = useMutation({
    mutationFn: clearRoster,
    onSuccess: (updated) => {
      queryClient.setQueryData(["roster"], updated);
      toast.success("Roster cleared.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Unknown error.");
    },
  });

  const archiveRosterMutation = useMutation({
    mutationFn: archiveRoster,
    onSuccess: () => {
      toast.success("Roster archived successfully.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Unknown error.");
    },
  });

  async function handleRefreshRaidHelper() {
    try {
      setIsRefreshingRaidHelper(true);

      const refreshedEvents = await fetchRaidHelperEventsWithMode(true);
      queryClient.setQueryData(["raid-helper-events"], refreshedEvents);

      if (selectedEventId) {
        const refreshedParticipants = await fetchRaidHelperParticipantsWithMode(
          selectedEventId,
          true,
        );
        queryClient.setQueryData(
          ["raid-helper-event-participants", selectedEventId],
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
  }, [data?.roster.selectedEventId, eventsQuery.data?.events, selectedEventId]);

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
    groupNumber: number;
    slotPosition: number;
    playerName: string;
    role?: string | null;
  }) {
    const targetGroup = data?.roster.groups.find(
      (group) => group.groupNumber === input.groupNumber,
    );

    if (!targetGroup) {
      toast.error("Group not found.");
      return;
    }

    setPendingDropTarget(`${input.groupNumber}-${input.slotPosition}`);

    try {
      const updated = await saveGroup({
        groupNumber: targetGroup.groupNumber,
        name: targetGroup.name,
        slots: targetGroup.slots.map((slot) => ({
          position: slot.position,
          playerName:
            slot.position === input.slotPosition
              ? input.playerName
              : slot.playerName,
          role:
            slot.position === input.slotPosition
              ? (input.role ?? slot.role)
              : slot.role,
        })),
      });

      handleGroupSaved(updated);
      toast.success(`Player assigned to group ${input.groupNumber}.`);
    } catch (error) {
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
  const row1 = groups.slice(0, 5);
  const row2 = groups.slice(5, 10);

  const assignedPlayerNames = new Set(
    groups.flatMap((g) =>
      g.slots.map((s) => s.playerName).filter(Boolean),
    ) as string[],
  );

  const sortedParticipants = [...(participantsQuery.data?.participants ?? [])]
    .filter((p) => {
      const key = p.name?.trim() || p.userId?.trim();
      return key ? !assignedPlayerNames.has(key) : true;
    })
    .sort((a, b) => {
      const roleA = resolveParticipantRole(a);
      const roleB = resolveParticipantRole(b);
      const priorityA = roleA ? (ROLE_SORT_PRIORITY[roleA] ?? 99) : 99;
      const priorityB = roleB ? (ROLE_SORT_PRIORITY[roleB] ?? 99) : 99;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      const nameA = (a.name ?? "").toLowerCase();
      const nameB = (b.name ?? "").toLowerCase();
      return nameA.localeCompare(nameB, "en");
    });

  const lastRefreshRaw = selectedEventId
    ? (participantsQuery.data?.participantsCachedAt ??
      eventsQuery.data?.eventsCachedAt ??
      null)
    : (eventsQuery.data?.eventsCachedAt ?? null);

  const lastRefreshDisplay = formatRefreshDateTime(lastRefreshRaw);
  const stale = isDataStale(lastRefreshRaw);

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

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-100">Roster</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowArchiveConfirm(true)}
            disabled={archiveRosterMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-400 transition hover:border-sky-500/60 hover:bg-sky-500/20 disabled:opacity-40"
            title="Archive current roster"
          >
            <FontAwesomeIcon icon={faArchive} className="h-3 w-3" />
            Archive
          </button>
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            disabled={clearRosterMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:border-red-500/60 hover:bg-red-500/20 disabled:opacity-40"
            title="Clear roster"
          >
            <FontAwesomeIcon icon={faTrash} className="h-3 w-3" />
            Clear
          </button>
        </div>
      </div>

      {/* ── Event selector ─────────────────────────────────────────────── */}
      <div className="mt-5 rounded-xl border border-slate-700/60 bg-slate-800/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <FontAwesomeIcon
              icon={faCalendarDays}
              className="h-4 w-4 shrink-0 text-sky-400"
            />
            <span className="text-sm font-medium text-slate-200">
              RaidHelper event
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

        {selectedEventId ? (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40">
            <div className="border-b border-slate-800 px-3 py-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Players to drag into groups
              </h3>
            </div>

            {participantsQuery.isLoading
              ? null
              : participantsQuery.isError
                ? null
                : (participantsQuery.data?.participants.length ?? 0) === 0
                  ? null
                  : (() => {
                      const allParticipants =
                        participantsQuery.data?.participants ?? [];
                      const roleCounts: Partial<Record<string, number>> = {};
                      for (const p of allParticipants) {
                        const role = resolveParticipantRole(p) ?? "__none";
                        roleCounts[role] = (roleCounts[role] ?? 0) + 1;
                      }
                      const orderedRoles = Object.keys(ROLE_META).sort(
                        (a, b) =>
                          (ROLE_SORT_PRIORITY[a] ?? 99) -
                          (ROLE_SORT_PRIORITY[b] ?? 99),
                      );
                      const visibleRoles = orderedRoles.filter(
                        (r) => (roleCounts[r] ?? 0) > 0,
                      );
                      if (visibleRoles.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-2 border-b border-slate-800 px-3 py-2">
                          {visibleRoles.map((roleKey) => {
                            const meta = ROLE_META[roleKey];
                            const count = roleCounts[roleKey] ?? 0;
                            return (
                              <span
                                key={roleKey}
                                className="flex items-center gap-1.5 rounded-full border border-slate-700/60 bg-slate-900/60 px-2.5 py-0.5 text-xs font-medium"
                              >
                                <FontAwesomeIcon
                                  icon={meta.icon}
                                  className={`h-2.5 w-2.5 ${meta.color}`}
                                />
                                <span className="text-slate-300">
                                  {meta.label}
                                </span>
                                <span className="text-slate-100 tabular-nums">
                                  {count}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      );
                    })()}

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
              <div className="max-h-80 overflow-auto p-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {sortedParticipants.map((participant, index) => (
                    <button
                      key={`${participant.userId ?? participant.name ?? "participant"}-${index}`}
                      type="button"
                      draggable
                      title={`${participant.name ?? "No name"}${participant.className ? ` | ${participant.className}` : ""}${participant.specName ? ` | ${participant.specName}` : ""}`}
                      onDragStart={(event) => {
                        const payload: DragParticipantPayload = {
                          name: participant.name,
                          userId: participant.userId,
                          specName: participant.specName,
                          className: participant.className,
                        };
                        const serialized = JSON.stringify(payload);
                        event.dataTransfer.setData(
                          "application/json",
                          serialized,
                        );
                        event.dataTransfer.setData("text/plain", serialized);
                        event.dataTransfer.effectAllowed = "copy";
                      }}
                      className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-left transition hover:border-sky-500/40 hover:bg-slate-900"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-800">
                        <RoleIcon role={resolveParticipantRole(participant)} />
                      </div>
                      <div className="min-w-0 truncate text-sm font-medium text-slate-100">
                        {participant.name ?? "No name"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-6 space-y-4">
        {/* Row 1 – groups 1-5 */}
        <div className="grid grid-cols-5 gap-3">
          {row1.map((group) => (
            <GroupCard
              key={group.groupNumber}
              group={group}
              onSaved={handleGroupSaved}
              onDropParticipant={handleParticipantDrop}
              pendingDropTarget={pendingDropTarget}
            />
          ))}
        </div>

        <div className="border-t border-slate-800/60" />

        {/* Row 2 – groups 6-10 */}
        <div className="grid grid-cols-5 gap-3">
          {row2.map((group) => (
            <GroupCard
              key={group.groupNumber}
              group={group}
              onSaved={handleGroupSaved}
              onDropParticipant={handleParticipantDrop}
              pendingDropTarget={pendingDropTarget}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 border-t border-slate-800 pt-4">
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
              Non assigné
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
