type StatCardProps = {
  label: string;
  value: string | number;
  valueColor?: string;
  subLabel?: string;
  className?: string;
};

export function StatCard({
  label,
  value,
  valueColor = "text-slate-100",
  subLabel,
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`rounded-lg border border-slate-700 bg-slate-900/50 p-3 ${className}`}
    >
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${valueColor}`}>{value}</p>
      {subLabel ? <p className="text-xs text-slate-500">{subLabel}</p> : null}
    </div>
  );
}
