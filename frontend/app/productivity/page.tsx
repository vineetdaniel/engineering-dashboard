import { DashboardShell } from "@/components/DashboardShell";
import { ProductivityClient } from "@/components/planning/ProductivityClient";
import {
  getDeveloperProductivity,
  getProductivityTrends,
  type ProductivitySummary,
  type ProductivityTrend,
} from "@/lib/api";
import { listSprints } from "@/lib/actions/sprints";

export const dynamic = "force-dynamic";

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

export default async function ProductivityPage() {
  // Fetch the initial (overall, 90d) view + chart data + sprint list for the
  // toggle, all in parallel. Connector endpoints can fail if the backend is
  // down — degrade to empty rather than crashing the page.
  const [summary, commitTrend, velocityTrend, sprintsResult] = await Promise.all([
    getDeveloperProductivity({ dateRange: "90d" }).catch(() => EMPTY_SUMMARY),
    getProductivityTrends("commits", "90d").catch(() => EMPTY_TREND),
    getProductivityTrends("velocity").catch(() => EMPTY_TREND),
    listSprints("all"),
  ]);

  return (
    <DashboardShell activeSection="planning">
      <ProductivityClient
        initialSummary={summary}
        initialCommitTrend={commitTrend}
        velocityTrend={velocityTrend}
        sprints={sprintsResult.data || []}
      />
    </DashboardShell>
  );
}
