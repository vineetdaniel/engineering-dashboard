export function ConnectorStatus({ health }: { health: any }) {
  const connectors = health?.connectors || {};
  return (
    <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
      {Object.entries(connectors).map(([name, status]: [string, any]) => (
        <div
          key={name}
          className={`p-3 rounded border ${status.ok ? "border-green-600 bg-green-900/20" : "border-red-600 bg-red-900/20"}`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold capitalize">{name}</span>
            <span className={`text-xs ${status.ok ? "text-green-400" : "text-red-400"}`}>
              {status.ok ? "Connected" : "Error"}
            </span>
          </div>
          {!status.ok && <p className="text-xs text-red-300 mt-1">{status.error}</p>}
        </div>
      ))}
    </div>
  );
}
