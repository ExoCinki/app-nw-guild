"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArchive,
  faChevronDown,
  faCalendar,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LoadingIndicator } from "@/components/loading-indicator";

type Archive = {
  id: string;
  eventId: string | null;
  eventTitle: string | null;
  archivedAt: string;
};

type ArchiveDetail = {
  id: string;
  eventId: string | null;
  eventTitle: string | null;
  archivedAt: string;
  snapshot: {
    selectedEventId: string | null;
    groups: Array<{
      groupNumber: number;
      name: string | null;
      slots: Array<{
        position: number;
        playerName: string | null;
        role: string | null;
      }>;
    }>;
  };
};

async function fetchArchives(): Promise<{ archives: Archive[] }> {
  const res = await fetch("/api/roster/archive", {
    credentials: "include",
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "Unable to load archives.");
  }

  return res.json();
}

async function fetchArchiveDetail(
  id: string,
): Promise<{ archive: ArchiveDetail }> {
  const res = await fetch(`/api/roster/archive/${id}`, {
    credentials: "include",
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "Unable to load archive.");
  }

  return res.json();
}

const ROLE_META: Record<string, { label: string; color: string }> = {
  tank: { label: "Tank", color: "text-blue-400" },
  bruiser: { label: "Bruiser", color: "text-rose-400" },
  dps: { label: "DPS", color: "text-red-400" },
  heal: { label: "Heal", color: "text-emerald-400" },
  debuff: { label: "Debuff", color: "text-violet-400" },
  dex: { label: "Dex", color: "text-amber-400" },
  late: { label: "Late", color: "text-yellow-400" },
  tentative: { label: "Tentative", color: "text-slate-400" },
  bench: { label: "Bench", color: "text-slate-500" },
};

export function ArchivesClient() {
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(
    null,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const archivesQuery = useQuery({
    queryKey: ["roster-archives"],
    queryFn: fetchArchives,
    retry: false,
  });

  const detailQuery = useQuery({
    queryKey: ["roster-archive-detail", selectedArchiveId],
    queryFn: () => fetchArchiveDetail(selectedArchiveId!),
    enabled: Boolean(selectedArchiveId),
    retry: false,
  });

  if (archivesQuery.isLoading) {
    return <LoadingIndicator />;
  }

  if (archivesQuery.isError) {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-300">
        {archivesQuery.error instanceof Error
          ? archivesQuery.error.message
          : "Unable to load archives."}
      </div>
    );
  }

  const archives = archivesQuery.data?.archives ?? [];
  const totalPages = Math.ceil(archives.length / ITEMS_PER_PAGE);
  const paginatedArchives = archives.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/30 backdrop-blur">
        <div className="flex items-center gap-3">
          <FontAwesomeIcon icon={faArchive} className="h-5 w-5 text-sky-400" />
          <h2 className="text-xl font-semibold text-slate-100">
            Roster Archives
          </h2>
        </div>

        <p className="mt-1 text-sm text-slate-400">View archived rosters</p>

        {archives.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No archive yet.</p>
        ) : (
          <>
            <div className="mt-6 space-y-3">
              {paginatedArchives.map((archive) => {
                const archivedDate = new Date(archive.archivedAt);
                const dateStr = archivedDate.toLocaleDateString("en-US", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                });
                const timeStr = archivedDate.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <button
                    key={archive.id}
                    onClick={() =>
                      setSelectedArchiveId(
                        selectedArchiveId === archive.id ? null : archive.id,
                      )
                    }
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-800/40 px-4 py-3 text-left transition hover:border-slate-600 hover:bg-slate-800/60"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-slate-200">
                          {archive.eventTitle || "Roster (no event)"}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                          <FontAwesomeIcon
                            icon={faCalendar}
                            className="h-3 w-3"
                          />
                          {dateStr} at {timeStr}
                        </div>
                      </div>
                      <FontAwesomeIcon
                        icon={faChevronDown}
                        className={`h-4 w-4 text-slate-500 transition ${
                          selectedArchiveId === archive.id ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {totalPages > 1 ? (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FontAwesomeIcon icon={faChevronLeft} className="h-3 w-3" />
                  Previous
                </button>

                <div className="text-xs text-slate-400">
                  Page {currentPage} of {totalPages}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                  <FontAwesomeIcon icon={faChevronRight} className="h-3 w-3" />
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {selectedArchiveId && detailQuery.data ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/30 backdrop-blur">
          <h3 className="text-lg font-semibold text-slate-100">
            Archive details
          </h3>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-5">
            {detailQuery.data.archive.snapshot.groups.map((group) => (
              <div
                key={group.groupNumber}
                className="rounded-lg border border-slate-700/60 bg-slate-800/40 overflow-hidden"
              >
                <div className="border-b border-slate-700 bg-slate-900/60 px-3 py-2">
                  <p className="truncate text-xs font-semibold text-slate-300">
                    {group.name || `Group ${group.groupNumber}`}
                  </p>
                </div>

                <div className="space-y-1 p-2">
                  {group.slots.map((slot) => (
                    <div key={slot.position} className="text-xs">
                      {slot.playerName ? (
                        <div className="rounded-md border border-slate-700 bg-slate-900/40 px-2 py-1.5">
                          <p className="truncate font-medium text-slate-100">
                            {slot.playerName}
                          </p>
                          {slot.role && (
                            <p
                              className={`mt-0.5 text-[10px] font-medium ${
                                ROLE_META[slot.role]?.color || "text-slate-400"
                              }`}
                            >
                              {ROLE_META[slot.role]?.label || slot.role}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-md border border-slate-700/40 px-2 py-1.5 text-center italic text-slate-600">
                          Empty
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
