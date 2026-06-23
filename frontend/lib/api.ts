const BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export async function api(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, options);
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
