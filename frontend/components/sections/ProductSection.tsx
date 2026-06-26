"use client";

import { useMemo } from "react";
import { CircleDot, TrendingUp, Zap, Activity, Layers } from "lucide-react";
import { SectionProps } from "./types";
import { SectionHeader } from "./SectionHeader";
import { Stat } from "@/components/widgets/Stat";
import { TrendChart } from "@/components/TrendChart";
import { DataTable } from "@/components/widgets/DataTable";
import { ProgressList } from "@/components/widgets/ProgressList";
import { DeveloperPointsTable } from "@/components/widgets/DeveloperPointsTable";
import { SprintDeveloperPoints } from "@/components/widgets/SprintDeveloperPoints";
import type { DataTableRow } from "@/components/widgets/DataTable";
import type { ProgressItem } from "@/components/widgets/ProgressList";
import type { DeveloperPointsRow } from "@/components/widgets/DeveloperPointsTable";
import type { SprintDeveloperRow } from "@/components/widgets/SprintDeveloperPoints";

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

  const backlogMetric = metrics.find((m) => m.metric_type === "backlog_story_points");
  const backlogPoints = backlogMetric?.value ?? 0;
  const backlogIssues = (backlogMetric?.meta?.issue_count as number) ?? 0;

  const developerOpenPoints = useMemo(() => {
    const byDev = new Map<string, DeveloperPointsRow>();
    for (const m of metrics.filter((m) => m.metric_type === "developer_open_story_points")) {
      const login = (m.meta?.assignee_login as string) || "unknown";
      const existing = byDev.get(login);
      if (existing) {
        existing.points += m.value ?? 0;
        existing.issueCount += (m.meta?.issue_count as number) ?? 0;
      } else {
        byDev.set(login, {
          login,
          name: (m.meta?.assignee_name as string) || login,
          points: m.value ?? 0,
          issueCount: (m.meta?.issue_count as number) ?? 0,
          project: m.entity,
        });
      }
    }
    return Array.from(byDev.values()).sort((a, b) => b.points - a.points);
  }, [metrics]);

  const sprintDeveloperPoints = useMemo(() => {
    const byKey = new Map<string, SprintDeveloperRow>();
    for (const m of metrics.filter((m) => m.metric_type === "sprint_points_per_developer")) {
      const login = (m.meta?.assignee_login as string) || "unknown";
      const sprint = (m.meta?.sprint_name as string) || "Sprint";
      const key = `${sprint}-${login}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.points += m.value ?? 0;
        existing.completedPoints += (m.meta?.completed_points as number) ?? 0;
      } else {
        byKey.set(key, {
          sprint,
          developer: (m.meta?.assignee_name as string) || login,
          login,
          points: m.value ?? 0,
          completedPoints: (m.meta?.completed_points as number) ?? 0,
          project: m.entity,
        });
      }
    }
    return Array.from(byKey.values()).sort((a, b) => b.points - a.points);
  }, [metrics]);

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Product Delivery"
        description="Sprint velocity, blocked work, and epic progress"
        lastUpdated={lastUpdated}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
        <Stat
          title="Backlog Points"
          value={backlogPoints}
          icon={Layers}
          variant={backlogPoints > 60 ? "warning" : "success"}
          subtext={`${backlogIssues} backlog issues`}
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
        <SprintDeveloperPoints
          rows={sprintDeveloperPoints}
          subtitle="Active sprint breakdown by assignee"
          dataSource={dataSource}
        />
        <DeveloperPointsTable
          rows={developerOpenPoints}
          subtitle="Unresolved points owned by each developer"
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
