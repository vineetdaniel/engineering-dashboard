"use client";

import { useMemo } from "react";
import { GitPullRequest, Timer, Activity, Zap } from "lucide-react";
import { SectionProps } from "./types";
import { SectionHeader } from "./SectionHeader";
import { Stat } from "@/components/widgets/Stat";
import { TrendChart } from "@/components/TrendChart";
import { DataTable } from "@/components/widgets/DataTable";
import { ReleaseTimeline } from "@/components/widgets/ReleaseTimeline";
import { TopDevelopers, type TopDeveloper } from "@/components/widgets/TopDevelopers";
import { PullRequestsTable, type PullRequestRow } from "@/components/widgets/PullRequestsTable";
import { JenkinsCIPanel } from "@/components/widgets/JenkinsCIPanel";
import type { DataTableRow } from "@/components/widgets/DataTable";

function lastValue(series: { value: number }[]) {
  return series.length ? series[series.length - 1].value : 0;
}

export function EngineeringSection({ data, metrics, events, lastUpdated, dataSource }: SectionProps) {
  const medianReview = metrics.find((m) => m.metric_type === "median_review_time")?.value;
  const ciPassRate = metrics.find((m) => m.metric_type === "ci_pass_rate")?.value;
  const flakyTests = metrics.find((m) => m.metric_type === "flaky_tests")?.value;
  const deployFreq = metrics.find((m) => m.metric_type === "deploy_frequency")?.value;
  const mttrMetric = metrics.find((m) => m.metric_type === "mttr_minutes");
  const mttr = mttrMetric?.value;
  const mttrRecoveries = mttrMetric?.meta?.recoveries ?? 0;
  const mttrDisplay = mttr != null && (mttr > 0 || mttrRecoveries > 0) ? `${mttr} min` : "—";
  const changeFailure = metrics.find((m) => m.metric_type === "change_failure_rate")?.value;

  const deploySeries =
    metrics
      .filter((m) => m.metric_type === "deploy_frequency")
      .slice(0, 8)
      .map((m, i) => ({ label: `D${i + 1}`, value: m.value ?? 0 })) ||
    [
      { label: "Mon", value: 4 },
      { label: "Tue", value: 6 },
      { label: "Wed", value: 3 },
      { label: "Thu", value: 8 },
      { label: "Fri", value: 5 },
    ];

  const reviewSeries =
    metrics
      .filter((m) => m.metric_type === "median_review_time")
      .slice(0, 8)
      .map((m, i) => ({ label: `D${i + 1}`, value: m.value ?? 0 })) ||
    [
      { label: "Mon", value: 5.2 },
      { label: "Tue", value: 5.0 },
      { label: "Wed", value: 4.8 },
      { label: "Thu", value: 4.5 },
      { label: "Fri", value: 4.2 },
    ];

  const ciSeries =
    metrics
      .filter((m) => m.metric_type === "ci_pass_rate")
      .slice(0, 8)
      .map((m, i) => ({ label: `D${i + 1}`, value: m.value ?? 0 })) ||
    [
      { label: "Mon", value: 94 },
      { label: "Tue", value: 95 },
      { label: "Wed", value: 96 },
      { label: "Thu", value: 97 },
      { label: "Fri", value: 97.4 },
    ];

  const mttrSeries =
    metrics
      .filter((m) => m.metric_type === "mttr_minutes")
      .slice(0, 8)
      .map((m, i) => ({ label: `D${i + 1}`, value: m.value ?? 0 })) ||
    [
      { label: "Mon", value: 42 },
      { label: "Tue", value: 38 },
      { label: "Wed", value: 55 },
      { label: "Thu", value: 31 },
      { label: "Fri", value: 28 },
    ];

  const changeFailureSeries =
    metrics
      .filter((m) => m.metric_type === "change_failure_rate")
      .slice(0, 8)
      .map((m, i) => ({ label: `D${i + 1}`, value: m.value ?? 0 })) ||
    [
      { label: "Mon", value: 4.2 },
      { label: "Tue", value: 3.8 },
      { label: "Wed", value: 5.1 },
      { label: "Thu", value: 3.5 },
      { label: "Fri", value: 3.2 },
    ];

  const commitMetrics = metrics.filter((m) => m.metric_type === "commit");

  const topDevelopers = useMemo<TopDeveloper[]>(() => {
    const map = new Map<string, TopDeveloper>();
    for (const m of commitMetrics) {
      const login = m.value_text || m.meta?.author_login || "Unknown";
      const name = m.meta?.author_name || login;
      const existing = map.get(login);
      if (existing) {
        existing.count += 1;
        if (m.entity && !existing.repos.includes(m.entity)) {
          existing.repos.push(m.entity);
        }
      } else {
        map.set(login, { login, name, count: 1, repos: m.entity ? [m.entity] : [] });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [commitMetrics]);

  const commitSeries = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const m of commitMetrics) {
      if (!m.timestamp) continue;
      const date = new Date(m.timestamp).toISOString().slice(0, 10);
      byDate.set(date, (byDate.get(date) || 0) + 1);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ label: date.slice(5), value }));
  }, [commitMetrics]);

  const stuckPRRows: DataTableRow[] = data.stuckPRs.map((e: any) => ({
    id: e.id,
    label: e.title,
    meta: e.entity,
    status: e.status,
    severity: ["critical", "high"].includes(e.severity) ? "high" : "medium",
    owner: e.owner,
  }));

  const releases = events.filter((e) => e.event_type === "release_deploy");

  const branchNames = new Set(
    commitMetrics.map((m) => m.meta?.branch).filter(Boolean)
  );

  const prRows: PullRequestRow[] = events
    .filter((e) => e.event_type === "pull_request")
    .map((e: any) => ({
      id: e.id,
      title: e.title,
      repo: e.entity,
      author: e.meta?.author_login,
      reviewers: e.meta?.reviewer_logins || [],
      mergedBy: e.meta?.merged_by_login,
      status: e.status,
      createdAt: e.meta?.created_at || e.happened_at,
      branch: e.meta?.branch,
      baseBranch: e.meta?.base_branch,
      url: e.meta?.url,
    }));

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Engineering Health"
        description="DORA metrics, review flow, and CI health"
        lastUpdated={lastUpdated}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          title="Open PRs"
          value={data.openPRs}
          icon={GitPullRequest}
          trend="up"
          trendLabel="2 this week"
          subtext="Awaiting review"
          sparklineData={[3, 5, 4, 6, 5, 7, data.openPRs]}
        />
        <Stat
          title="Median Review Time"
          value={medianReview != null ? `${medianReview}h` : "4.2h"}
          icon={Timer}
          variant="success"
          trend="down"
          trendLabel="-0.8h"
          target="<6h"
          sparklineData={reviewSeries.map((s) => s.value)}
        />
        <Stat
          title="CI Pass Rate"
          value={ciPassRate != null ? `${ciPassRate}%` : "97.4%"}
          trend="up"
          trendLabel="+1.2%"
          icon={Activity}
          variant="success"
          target=">95%"
          sparklineData={ciSeries.map((s) => s.value)}
        />
        <Stat
          title="Flaky Tests"
          value={flakyTests ?? 3}
          trend="down"
          trendLabel="-2"
          icon={Zap}
          variant="warning"
          trendInverse
          target="0"
          sparklineData={[7, 6, 5, 4, flakyTests ?? 3]}
        />
        <Stat
          title="Change Failure Rate"
          value={changeFailure != null ? `${changeFailure}%` : "—"}
          icon={Activity}
          variant={changeFailure > 5 ? "danger" : "success"}
          trendInverse
          target="<5%"
        />
        <Stat
          title="MTTR"
          value={mttrDisplay}
          icon={Timer}
          variant={mttr != null && mttr > 0 && mttr > 60 ? "warning" : "success"}
          subtext={mttrRecoveries > 0 ? `${mttrRecoveries} recoveries` : "no recoveries in window"}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TrendChart
          title="Deployment Frequency"
          subtitle={`${lastValue(deploySeries)} deploys / day`}
          data={deploySeries}
          type="bar"
          target={5}
          targetLabel="Target"
          className="h-64"
          dataSource={dataSource}
        />
        <TrendChart
          title="Median Review Time"
          subtitle={`Latest ${lastValue(reviewSeries).toFixed(1)}h`}
          data={reviewSeries}
          type="area"
          color="#10b981"
          target={6}
          targetLabel="Target <6h"
          className="h-64"
          dataSource={dataSource}
        />
        <TrendChart
          title="MTTR (Mean Time to Recovery)"
          subtitle={`Latest ${lastValue(mttrSeries).toFixed(0)} min`}
          data={mttrSeries}
          type="area"
          color="#8b5cf6"
          target={60}
          targetLabel="Target <60m"
          className="h-64"
          dataSource={dataSource}
        />
        <TrendChart
          title="Change Failure Rate"
          subtitle={`Latest ${lastValue(changeFailureSeries).toFixed(1)}%`}
          data={changeFailureSeries}
          type="area"
          color="#f59e0b"
          target={5}
          targetLabel="Target <5%"
          className="h-64"
          dataSource={dataSource}
        />
      </div>

      <JenkinsCIPanel metrics={metrics} events={events} dataSource={dataSource} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <TopDevelopers
          developers={topDevelopers}
          maxRows={6}
          dataSource={dataSource}
          subtitle={`By commit count · ${branchNames.size || 1} branch${branchNames.size === 1 ? "" : "es"}`}
        />
        <div className="lg:col-span-2">
          <TrendChart
            title="Commit Activity"
            subtitle={`${commitMetrics.length} commits in selected range`}
            data={commitSeries}
            type="bar"
            color="#6366f1"
            className="h-64"
            dataSource={dataSource}
          />
        </div>
      </div>

      <PullRequestsTable
        rows={prRows}
        title="Pull Requests Raised"
        subtitle="Author, reviewer, and merger"
        dataSource={dataSource}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DataTable
            title="PRs Stuck > 48h"
            subtitle="Awaiting review or author action"
            rows={stuckPRRows}
            emptyText="No stuck PRs — great flow!"
            dataSource={dataSource}
          />
        </div>
        <ReleaseTimeline releases={releases} dataSource={dataSource} />
      </div>
    </div>
  );
}
