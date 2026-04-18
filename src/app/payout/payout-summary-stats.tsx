export function PayoutSummaryStats({
  goldPool,
  totalPoints,
  goldPerPoint,
}: {
  goldPool: number;
  totalPoints: number;
  goldPerPoint: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-4 p-4 bg-blue-950 rounded border border-blue-700">
      <div>
        <div className="text-sm text-slate-400">Gold total</div>
        <div className="text-2xl font-bold text-yellow-400">
          {goldPool.toFixed(0)}
        </div>
      </div>
      <div>
        <div className="text-sm text-slate-400">Total points</div>
        <div className="text-2xl font-bold text-blue-400">{totalPoints}</div>
      </div>
      <div>
        <div className="text-sm text-slate-400">Price per point</div>
        <div className="text-2xl font-bold text-emerald-400">
          {Math.floor(goldPerPoint)}
        </div>
      </div>
    </div>
  );
}
