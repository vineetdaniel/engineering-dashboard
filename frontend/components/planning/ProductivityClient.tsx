"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TrendChart } from "@/components/TrendChart";
import { PlanningSubNav } from "./PlanningSubNav";
import { WorkloadHeatmap } from "./WorkloadHeatmap";
import { SprintVelocityChart } from "./SprintVelocityChart";
import { AlertCircle, ArrowUpDown } from "lucide-react";
import {
  getDeveloperProductivity,
  getProductivityTrends,
  type ProductivitySummary,
  type ProductivityTrend,
  type DeveloperProductivity,
} from "@/lib/api";

import type { SprintListItem } from "@/lib/actions/sprints";

type DateRange = "24h" | "7d" | "30d" | "90d";
type SortKey = "name" | "commits" | "allocated_story_points" | "completion_pct" | "sp_per_effective_hour" | "jira_open_issues";

const EMPTY_SUMMARY: ProductivitySummary = {
  developers: [],
  unmatched: [],
  total_commits: 0,
  total_allocated_points: 0,
  total_done_tasks: 0,
  total_tasks: 0,
  avg_completion_pct: 0,
  active_developers: 0,
};

const EMPTY_TREND: ProductivityTrend = { metric: "", points: [] };

interface ProductivityClientProps {
  initialSummary?: ProductivitySummary;
  initialCommitTrend?: ProductivityTrend;
  sprints: SprintListItem[];
}

export function ProductivityClient({
  initialSummary,
  initialCommitTrend,
  sprints,
}: ProductivityClientProps) {
  const [summary, setSummary] = useState(initialSummary ?? EMPTY_SUMMARY);
  const [commitTrend, setCommitTrend] = useState(initialCommitTrend ?? EMPTY_TREND);
  const [scope, setScope] = useState<"overall" | "sprint">("overall");
  const [sprintId, setSprintId] = useState<number | "">(sprints[0]?.id ?? "");
  const [dateRange, setDateRange] = useState<DateRange>("90d");
  const [sortKey, setSortKey] = useState<SortKey>("commits");
  const [loading, setLoading] = useState(!summary.developers.length);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    // Skip the very first render only when the server already provided data.
    // If the server shipped an empty payload, fetch immediately so the page
    // populates without blocking SSR on the heavy developer-signals query.
    if (!mounted.current) {
      mounted.current = true;
      if (summary.developers.length > 0) return;
    }
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    const opts =
      scope === "sprint" && sprintId !== ""
        ? { sprint_id: Number(sprintId) }
        : { dateRange };
    (async () => {
      try {
        const [s, t] = await Promise.all([
          getDeveloperProductivity(opts),
          getProductivityTrends("commits", dateRange),
        ]);
        if (cancelled) return;
        setSummary(s);
        setCommitTrend(t);
      } catch (err) {
        if (!cancelled) setFetchError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scope, sprintId, dateRange]);

  const sorted = [...summary.developers].sort((a, b) => {
    if (sortKey === "name") return a.name.localeCompare(b.name);
    const av = (a[sortKey] as number) ?? 0;
    const bv = (b[sortKey] as number) ?? 0;
    return bv - av;
  });

  const topByCommits = [...summary.developers]
    .filter((d) => d.commits > 0)
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 8)
    .map((d) => ({ label: d.name.split(" ")[0], value: d.commits }));

  const isInitialLoading = loading && summary.developers.length === 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Developer productivity</h1>
          <p className="text-sm text-muted-foreground">
            Planning velocity joined with GitHub commits and Jira delivery.
          </p>
        </div>
      </div>

      <PlanningSubNav active="productivity" />

      {isInitialLoading ? (
        <ProductivitySkeleton />
      ) : (
        <>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={scope} onValueChange={(v) => setScope(v as "overall" | "sprint")}>
          <TabsList>
            <TabsTrigger value="overall">Overall</TabsTrigger>
            <TabsTrigger value="sprint">By sprint</TabsTrigger>
          </TabsList>
        </Tabs>

        {scope === "sprint" ? (
          <select
            value={sprintId}
            onChange={(e) => setSprintId(e.target.value === "" ? "" : Number(e.target.value))}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          >
            {sprints.length === 0 && <option value="">No sprints</option>}
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        )}
        {loading && <span className="text-xs text-muted-foreground">Updating…</span>}
        {fetchError && <span className="text-xs text-destructive">{fetchError}</span>}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard label="Active developers" value={summary.active_developers} />
        <SummaryCard label="Commits" value={summary.total_commits} />
        <SummaryCard label="Allocated SP" value={summary.total_allocated_points} />
        <SummaryCard
          label="Avg completion"
          value={`${summary.avg_completion_pct}%`}
          sub={`${summary.total_done_tasks}/${summary.total_tasks} tasks`}
        />
        <SummaryCard label="Unmatched ids" value={summary.unmatched.length} muted />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendChart
          title="Commit activity"
          subtitle={`${summary.total_commits} commits, ${scope === "sprint" ? "selected sprint" : dateRange}`}
          data={commitTrend.points}
          type="bar"
          color="#6366f1"
          className="h-64"
        />
        <SprintVelocityChart />
      </div>

      {/* Workload risk heatmap */}
      <WorkloadHeatmap developers={summary.developers} />

      {/* Per-developer table */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Per-developer breakdown</h2>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowUpDown size={12} />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded border border-input bg-background px-1 py-0.5 text-xs"
            >
              <option value="commits">Sort: Commits</option>
              <option value="allocated_story_points">Sort: Allocated SP</option>
              <option value="jira_open_issues">Sort: Jira Open</option>
              <option value="completion_pct">Sort: Completion</option>
              <option value="sp_per_effective_hour">Sort: SP / eff hr</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Developer</th>
                <th className="px-4 py-2">Team</th>
                <th className="px-4 py-2 text-right">Commits</th>
                <th className="px-4 py-2 text-right">+Lines</th>
                <th className="px-4 py-2 text-right">-Lines</th>
                <th className="px-4 py-2 text-right">Alloc SP</th>
                <th className="px-4 py-2 text-right">Plan tasks</th>
                <th className="px-4 py-2 text-right">Jira open</th>
                <th className="px-4 py-2 text-right">Done %</th>
                <th className="px-4 py-2 text-right">SP/eff hr</th>
                <th className="px-4 py-2 text-right">Jira done</th>
                <th className="px-4 py-2">Mix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((d) => (
                <DevRow key={d.resource_id ?? d.name} d={d} />
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
                    No developer data for this selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Unmatched connector identities */}
      {summary.unmatched.length > 0 && (
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertCircle size={16} className="text-warning" />
            <h2 className="text-sm font-semibold">
              Unmatched identities ({summary.unmatched.length})
            </h2>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Commit/Jira identities with no matching planning resource (often GitHub logins like
            <code className="mx-1">payme-akash</code> rather than display names). Add explicit
            handles to resources later for exact joins.
          </p>
          <div className="flex flex-wrap gap-2">
            {summary.unmatched
              .sort((a, b) => b.commits - a.commits)
              .map((u) => (
                <Badge key={u.name} variant="secondary" className="text-xs">
                  {u.name} · {u.commits} commits
                </Badge>
              ))}
          </div>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Note: story points reflect <em>planned</em> effort, not delivered value. There is no
        true task-completion timestamp yet, so cycle-time metrics are approximate. Identity
        matching is by name (fuzzy); see unmatched identities above.
      </p>
        </>
      )}
    </div>
  );
}

function ProductivitySkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-9 w-48 rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-xl bg-muted" />
        <div className="h-64 rounded-xl bg-muted" />
      </div>
      <div className="h-80 rounded-xl bg-muted" />
      <div className="h-96 rounded-xl bg-muted" />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  muted,
}: {
  label: string;
  value: number | string;
  sub?: string;
  muted?: boolean;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${muted ? "text-muted-foreground" : ""}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

function DevRow({ d }: { d: DeveloperProductivity }) {
  const mix = Object.entries(d.category_mix).filter(([, n]) => n > 0);
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-2 font-medium">{d.name}</td>
      <td className="px-4 py-2 text-muted-foreground">{d.team || "—"}</td>
      <td className="px-4 py-2 text-right">{d.commits}</td>
      <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400">
        {d.lines_added > 0 ? `+${d.lines_added.toLocaleString()}` : "—"}
      </td>
      <td className="px-4 py-2 text-right text-red-500">
        {d.lines_deleted > 0 ? `-${d.lines_deleted.toLocaleString()}` : "—"}
      </td>
      <td className="px-4 py-2 text-right">{d.allocated_story_points}</td>
      <td className="px-4 py-2 text-right text-muted-foreground">
        {d.done_tasks}/{d.total_tasks}
      </td>
      <td className="px-4 py-2 text-right">
        {d.jira_open_issues > 0 ? (
          <span className="font-medium text-amber-600 dark:text-amber-400">{d.jira_open_issues}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-2 text-right">{d.completion_pct}%</td>
      <td className="px-4 py-2 text-right">{d.sp_per_effective_hour ?? "—"}</td>
      <td className="px-4 py-2 text-right text-muted-foreground">
        {d.jira_done_issues > 0 ? (
          <span className="text-emerald-600 dark:text-emerald-400">
            {d.jira_done_issues}
            {d.jira_done_points > 0 && <span className="ml-1 text-xs text-muted-foreground">({d.jira_done_points} SP)</span>}
          </span>
        ) : "—"}
      </td>
      <td className="px-4 py-2">
        <span className="flex flex-wrap gap-1">
          {mix.length === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            mix.map(([cat, n]) => (
              <Badge key={cat} variant="secondary" className="text-[10px]">
                {cat[0].toUpperCase()}
                {n}
              </Badge>
            ))
          )}
        </span>
      </td>
    </tr>
  );
}
