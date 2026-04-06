type LoadingIndicatorProps = {
  compact?: boolean;
};

export function LoadingIndicator({ compact = false }: LoadingIndicatorProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/30 backdrop-blur ${compact ? "p-3 rounded-lg" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
        <div className="h-3 w-24 animate-pulse rounded bg-slate-700/70" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-2 animate-pulse rounded bg-slate-800/80" />
        <div className="h-2 w-5/6 animate-pulse rounded bg-slate-800/70" />
        <div className="h-2 w-2/3 animate-pulse rounded bg-slate-800/60" />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function InlineLoadingIndicator() {
  return (
    <div
      className="flex items-center gap-2 py-2"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
      <div className="h-2 w-16 animate-pulse rounded bg-slate-700/70" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
