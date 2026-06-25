"use client";

import { CircleDot, TrendingUp, Zap, Activity } from "lucide-react";
import { SectionProps } from "./types";
import { SectionHeader } from "./SectionHeader";
import { Stat } from "@/components/widgets/Stat";
import { TrendChart } from "@/components/TrendChart";
import { DataTable } from "@/components/widgets/DataTable";
import { ProgressList } from "@/components/widgets/ProgressList";
import type { DataTableRow } from "@/components/widgets/DataTable";
import type { ProgressItem } from "@/components/widgets/ProgressList";

export function ProductSection({ data, metrics, events, lastUpdated, dataSource }: SectionProps) {
  const blockedRows: DataTableRow[] = data.blocked.map((e) => ({
    id: e.id,
    label: e.title,
    meta: e.entity,
    status: e.status,
    severity: ["critical", "high"].includes(e.severity) ? "high" : "medium",
  }));

  const velocityMetrics = metrics.filter((m) => m.metric_type === "sprint_velocity").slice(0, 6).reverse();
  const velocityTrend = velocityMetrics.length
    ? velocityMetrics.map((m, i) => ({ label: `S${i + 1}`, value: m.value ?? 0 }))
    : [
        { label: "S1", value: 38 },
        { label: "S2", value: 42 },
        { label: "S3", value: 36 },
        { label: "S4", value: 45 },
        { label: "S5", value: 41 },
        { label: "S6", value: 45 },
      ];

  const burndownMetrics = metrics.filter((m) => m.metric_type === "sprint_remaining_points").slice(0, 5);
  const burndown = burndownMetrics.length
    ? burndownMetrics.map((m, i) => ({
        label: ["Mon", "Tue", "Wed", "Thu", "Fri"][i],
        committed: (m.meta?.committed ?? 45) as number,
        remaining: m.value ?? 0,
      }))
    : [
        { label: "Mon", committed: 45, remaining: 45 },
        { label: "Tue", committed: 45, remaining: 38 },
        { label: "Wed", committed: 45, remaining: 28 },
        { label: "Thu", committed: 45, remaining: 18 },
        { label: "Fri", committed: 45, remaining: 12 },
      ];

  const epicProgress = events
    .filter((e) => e.event_type === "epic_progress")
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      label: e.title,
      value: e.meta?.pct ?? 0,
      meta: e.meta?.squad || e.entity,
      owner: e.meta?.owner,
      status: e.meta?.status || "on track",
    }));

  const epics: ProgressItem[] = epicProgress.length
    ? epicProgress
    : [
        { id: 1, label: "Real-time payments v2", value: 72, meta: "Payments", owner: "Sarah", status: "on track" },
        { id: 2, label: "SOC 2 evidence portal", value: 45, meta: "Security", owner: "Mike", status: "at risk" },
        { id: 3, label: "Ledger reconciliation", value: 90, meta: "Data", owner: "Priya", status: "closing" },
      ];

  const latestVelocity = velocityMetrics[velocityMetrics.length - 1]?.value ?? 45;
  const sprintProgressPct =
    burndown[0]?.committed > 0
      ? Math.round(((burndown[0].committed - (burndown[burndown.length - 1]?.remaining ?? 0)) / burndown[0].committed) * 100)
      : 68;

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Product Delivery"
        description="Sprint velocity, blocked work, and epic progress"
        lastUpdated={lastUpdated}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          title="Open Issues"
          value={data.openIssues}
          icon={CircleDot}
          sparklineData={[18, 19, 18, 20, 19, data.openIssues, data.openIssues]}
        />
        <Stat
          title="Sprint Progress"
          value={`${sprintProgressPct}%`}
          trend="up"
          trendLabel="on track"
          icon={TrendingUp}
          variant={sprintProgressPct >= 80 ? "success" : "warning"}
        />
        <Stat
          title="Blocked"
          value={data.blocked.length}
          icon={Zap}
          variant={data.blocked.length > 5 ? "danger" : "warning"}
          trendInverse
        />
        <Stat
          title="Velocity"
          value={latestVelocity}
          trend="up"
          trendLabel="+12%"
          icon={Activity}
          sparklineData={velocityTrend.map((v) => v.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TrendChart
          title="Sprint Burndown"
          subtitle="Committed vs remaining story points"
          data={burndown}
          type="composed"
          dataSource={dataSource}
          series={[
            { key: "committed", label: "Committed", color: "#94a3b8", type: "bar" },
            { key: "remaining", label: "Remaining", color: "#6366f1", type: "area" },
          ]}
        />
        <TrendChart
          title="Velocity Trend"
          subtitle="Story points / sprint (last 6)"
          data={velocityTrend}
          dataSource={dataSource}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ProgressList
          title="Epic Progress"
          subtitle="Top initiatives by completion"
          items={epics}
        />
        <DataTable
          title="Blocked Tickets"
          subtitle="Items marked blocked in Jira"
          rows={blockedRows}
          maxRows={6}
          dataSource={dataSource}
        />
      </div>
    </div>
  );
}
