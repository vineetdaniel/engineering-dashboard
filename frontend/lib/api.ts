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

export interface DeveloperProductivity {
  resource_id: number | null;
  name: string;
  team: string | null;
  role: string | null;
  allocated_story_points: number;
  effective_hours: number;
  total_tasks: number;
  done_tasks: number;
  completion_pct: number;
  sp_per_effective_hour: number | null;
  category_mix: Record<string, number>;
  commits: number;
  lines_added: number;
  lines_deleted: number;
  jira_done_points: number;
  jira_open_points: number;
  jira_open_issues: number;
  jira_done_issues: number;
  matched: boolean;
}

export interface ProductivitySummary {
  developers: DeveloperProductivity[];
  unmatched: DeveloperProductivity[];
  total_commits: number;
  total_allocated_points: number;
  total_done_tasks: number;
  total_tasks: number;
  avg_completion_pct: number;
  active_developers: number;
}

export interface ProductivityTrend {
  metric: string;
  points: { label: string; value: number }[];
}

export const getDeveloperProductivity = (opts?: {
  dateRange?: ApiFilters["dateRange"];
  sprint_id?: number;
  team?: string;
}): Promise<ProductivitySummary> => {
  const params = new URLSearchParams();
  if (opts?.dateRange) params.set("dateRange", opts.dateRange);
  if (opts?.sprint_id != null) params.set("sprint_id", String(opts.sprint_id));
  if (opts?.team && opts.team !== "all") params.set("team", opts.team);
  return api(`/productivity/developers?${params.toString()}`);
};

export const getProductivityTrends = (
  metric: "commits" | "velocity",
  dateRange?: ApiFilters["dateRange"]
): Promise<ProductivityTrend> => {
  const params = new URLSearchParams({ metric });
  if (dateRange) params.set("dateRange", dateRange);
  return api(`/productivity/trends?${params.toString()}`);
};

export interface GitHubLogin {
  login: string;
  display_name: string;
  commits: number;
}

export const getGitHubLogins = (): Promise<GitHubLogin[]> =>
  api("/productivity/github-logins");

export interface JiraAssignee {
  account_id: string;
  display_name: string;
  open_issues: number;
  open_sp: number;
}

export const getJiraAssignees = (): Promise<JiraAssignee[]> =>
  api("/productivity/jira-assignees");

export interface SprintVelocityDev {
  name: string;
  team: string;
  sprints: Record<number, { sp: number; eff_hours: number }>;
}
export interface SprintVelocityData {
  sprints: { id: number; name: string }[];
  developers: SprintVelocityDev[];
}
export const getSprintVelocity = (): Promise<SprintVelocityData> =>
  api("/productivity/sprint-velocity");
