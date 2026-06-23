const isServer = typeof window === "undefined";
const DEFAULT_BASE = isServer
  ? (process.env.BACKEND_URL || "http://localhost:8000")
  : (process.env.NEXT_PUBLIC_API_URL || "");

export async function api(path: string, options?: RequestInit) {
  const base = DEFAULT_BASE;
  const url = `${base}${path}`;
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const getHealth = () => api("/health");
export const getSettings = () => api("/settings");
export const getConnectorHealth = () => api("/connectors/health");
export const syncSource = (source: string) =>
  api(`/sync/${source}`, { method: "POST" });
export const getMetrics = (params?: Record<string, string>) =>
  api(`/metrics?${new URLSearchParams(params).toString()}`);
export const getEvents = (params?: Record<string, string>) =>
  api(`/events?${new URLSearchParams(params).toString()}`);
