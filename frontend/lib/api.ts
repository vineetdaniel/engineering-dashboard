const isServer = typeof window === "undefined";
const DEFAULT_BASE = isServer
  ? (process.env.BACKEND_URL || "http://127.0.0.1:8000")
  : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000");

export async function api(path: string, options?: RequestInit) {
  const base = DEFAULT_BASE;
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, { ...options, cache: "no-store" });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  } catch (err) {
    console.error(`API call failed: ${url}`, err);
    throw err;
  }
}

export const getHealth = () => api("/health");
export const getSettings = () => api("/settings");
export const getConnectorHealth = () => api("/connectors/health");
export const getConnectorConfigs = () => api("/settings/connectors");
export const getConnectorGuide = (name: string) => api(`/settings/connectors/${name}/guide`);
export const saveConnectorConfig = (name: string, config: Record<string, string>) =>
  api(`/settings/connectors/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
export const syncSource = (source: string) =>
  api(`/sync/${source}`, { method: "POST" });

export const uploadComplianceFile = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api("/compliance/upload", { method: "POST", body: form });
};

export const generateNewsletter = async () => {
  const base = DEFAULT_BASE;
  const res = await fetch(`${base}/reports/newsletter`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Newsletter error: ${res.status}`);
  return res.arrayBuffer();
};

export interface ApiFilters {
  dateRange?: "24h" | "7d" | "30d" | "90d";
  squad?: string;
  environment?: string;
}

function buildParams(filters?: ApiFilters, extra?: Record<string, string>) {
  const params = new URLSearchParams();
  if (filters?.dateRange) params.set("dateRange", filters.dateRange);
  if (filters?.squad && filters.squad !== "all") params.set("squad", filters.squad);
  if (filters?.environment && filters.environment !== "all") params.set("environment", filters.environment);
  if (extra) {
    Object.entries(extra).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
  }
  return params.toString();
}

export const getMetrics = (filters?: ApiFilters, metric_type?: string) =>
  api(`/metrics?${buildParams(filters, metric_type ? { metric_type } : undefined)}`);

export const getEvents = (filters?: ApiFilters, event_type?: string) =>
  api(`/events?${buildParams(filters, event_type ? { event_type } : undefined)}`);
