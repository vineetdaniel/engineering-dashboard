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
  const [summary, commitTrend, sprintsResult] = await Promise.all([
    getDeveloperProductivity({ dateRange: "90d" }).catch(() => EMPTY_SUMMARY),
    getProductivityTrends("commits", "90d").catch(() => EMPTY_TREND),
    listSprints("all"),
  ]);

  return (
    <DashboardShell activeSection="planning">
      <ProductivityClient
        initialSummary={summary}
        initialCommitTrend={commitTrend}
        sprints={sprintsResult.data || []}
      />
    </DashboardShell>
  );
}
