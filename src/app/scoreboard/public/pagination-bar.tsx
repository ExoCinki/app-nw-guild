"use client";

type PaginationBarProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemLabel?: string;
  onPrev: () => void;
  onNext: () => void;
};

export function PaginationBar({
  currentPage,
  totalPages,
  totalItems,
  itemLabel = "élément(s)",
  onPrev,
  onNext,
}: PaginationBarProps) {
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
      <span>
        Page {currentPage}/{totalPages} — {totalItems} {itemLabel}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={onPrev}
          className="rounded border border-slate-700 bg-slate-800/60 px-2 py-1 text-slate-300 disabled:opacity-40"
        >
          Précédent
        </button>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={onNext}
          className="rounded border border-slate-700 bg-slate-800/60 px-2 py-1 text-slate-300 disabled:opacity-40"
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
