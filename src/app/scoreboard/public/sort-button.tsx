"use client";

import type { SortDir } from "./types";

type SortButtonProps = {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
};

export function SortButton({ label, active, dir, onClick }: SortButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-left text-xs uppercase tracking-wide text-slate-400 hover:text-slate-200"
    >
      {label}
      <span className={active ? "text-sky-300" : "text-slate-600"}>
        {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );
}
