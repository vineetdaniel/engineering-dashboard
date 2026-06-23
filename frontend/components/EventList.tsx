export function EventList({ title, events }: { title: string; events: any[] }) {
  return (
    <div className="p-4 rounded-xl bg-cto-800 border border-slate-700">
      <h2 className="text-lg font-semibold mb-3">{title} <span className="text-slate-400">({events.length})</span></h2>
      <ul className="space-y-2 max-h-96 overflow-auto">
        {events.length === 0 && <li className="text-slate-500 italic">No items</li>}
        {events.map((e) => (
          <li key={e.id} className="flex justify-between items-start border-b border-slate-700 pb-2">
            <div>
              <p className="font-medium">{e.title}</p>
              <p className="text-xs text-slate-400">{e.entity} · {e.status}</p>
            </div>
            {e.severity && (
              <span className="text-xs px-2 py-1 rounded bg-red-900 text-red-200">{e.severity}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
