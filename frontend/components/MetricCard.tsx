export function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="p-4 rounded-xl bg-cto-800 border border-slate-700">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="text-3xl font-bold text-cto-accent">{value}</p>
    </div>
  );
}
