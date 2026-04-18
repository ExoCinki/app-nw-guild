export function PayoutEmptyState({ hasSessions }: { hasSessions: boolean }) {
  return (
    <div className="lg:col-span-2 flex items-center justify-center p-6 bg-slate-900 rounded border border-slate-700">
      <div className="text-center text-slate-400">
        {hasSessions
          ? "Select a session"
          : "Create a new session to get started"}
      </div>
    </div>
  );
}
