"use client";

import {
  GitPullRequest,
  Bug,
  CircleDot,
  Timer,
  Activity,
  Zap,
  TrendingUp,
} from "lucide-react";
import { SectionProps } from "./types";
import { SectionHeader } from "./SectionHeader";
import { ConnectorStatus } from "@/components/ConnectorStatus";
import { Stat } from "@/components/widgets/Stat";
import { TrendChart } from "@/components/TrendChart";
import { DataTable } from "@/components/widgets/DataTable";
import { ActionCenter } from "@/components/widgets/ActionCenter";
import { ExportReport } from "@/components/widgets/ExportReport";
import { Predictions } from "@/components/widgets/Predictions";
import { IncidentCommandCenter } from "@/components/widgets/IncidentCommandCenter";
import { FintechMetrics } from "@/components/widgets/FintechMetrics";
import { DataQuality } from "@/components/widgets/DataQuality";
import { SquadScorecard } from "@/components/widgets/SquadScorecard";
import { ExecutiveSummary } from "@/components/widgets/ExecutiveSummary";
import { AuditReadiness } from "@/components/widgets/AuditReadiness";
import { DataFreshness } from "@/components/widgets/DataFreshness";
import type { DataTableRow } from "@/components/widgets/DataTable";
import type { ActionItem } from "@/components/widgets/ActionCenter";

const velocityData = [
  { label: "W1", value: 34 },
  { label: "W2", value: 42 },
  { label: "W3", value: 38 },
  { label: "W4", value: 45 },
];

const bugData = [
  { label: "W1", value: 12 },
  { label: "W2", value: 9 },
  { label: "W3", value: 7 },
  { label: "W4", value: 5 },
];

export function OverviewSection({ settings, health, data, metrics, events, filters, onSync, syncLoading, lastUpdated, dataSource, healthLoading }: SectionProps) {
  const blockedRows: DataTableRow[] = data.blocked.map((e) => ({
    id: e.id,
    label: e.title,
    meta: e.entity,
    status: e.status,
    severity: ["critical", "high"].includes(e.severity) ? "high" : "medium",
  }));

  const cveRows: DataTableRow[] = data.cves.slice(0, 20).map((e) => ({
    id: e.id,
    label: e.title,
    meta: e.entity,
    status: e.status,
    severity: e.severity === "critical" ? "critical" : e.severity === "high" ? "high" : "medium",
  }));

  const actionItems: ActionItem[] = [
    ...data.cves
      .filter((e) => e.severity === "critical")
      .slice(0, 3)
      .map((e) => ({
        id: `cve-${e.id}`,
        type: "cve" as const,
        title: e.title,
        meta: e.entity,
        severity: "critical" as const,
      })),
    ...data.blocked.slice(0, 3).map((e) => ({
      id: `blocked-${e.id}`,
      type: "blocked" as const,
      title: e.title,
      meta: e.entity,
      owner: e.owner,
      severity: (["critical", "high"].includes(e.severity) ? "high" : "medium") as "high" | "medium",
    })),
  ];

  // Read DORA-ish metrics from backend when available
  const changeFailureRate = metrics.find((m) => m.metric_type === "change_failure_rate")?.value;
  const mttr = metrics.find((m) => m.metric_type === "mttr_minutes")?.value;
  const deployFreq = metrics.find((m) => m.metric_type === "deploy_frequency")?.value;

  const activeIncidents = events.filter((e) => e.event_type === "incident" && e.status !== "resolved");

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Overview"
        description={`Observability: ${settings?.observability_provider || "—"}`}
        lastUpdated={lastUpdated}
      />

      <ConnectorStatus
        health={health}
        onSync={onSync}
        loading={syncLoading}
        isLoading={healthLoading}
      />

      <ExecutiveSummary data={data} metrics={metrics} events={events} dataSource={dataSource} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <IncidentCommandCenter incidents={activeIncidents} dataSource={dataSource} />
        </div>
        <DataFreshness lastUpdated={lastUpdated} backendOk={true} onRefresh={() => window.location.reload()} />
      </div>

      <SquadScorecard metrics={metrics} events={events} dataSource={dataSource} />

      <AuditReadiness metrics={metrics} events={events} dataSource={dataSource} />

      <FintechMetrics metrics={metrics} dataSource={dataSource} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ActionCenter items={actionItems} dataSource={dataSource} />
        <ExportReport
          data={{
            openPRs: data.openPRs,
            openIssues: data.openIssues,
            openBugs: data.openBugs,
            criticalCount: data.criticalCount,
            incidentCount: data.activeIncidents.length,
            paymentSuccessRate: metrics.find((m) => m.metric_type === "payment_success_rate")?.value ?? null,
            fraudRate: metrics.find((m) => m.metric_type === "fraud_rate")?.value ?? null,
            uptime: metrics.find((m) => m.metric_type === "uptime_pct")?.value ?? null,
          }}
          filters={filters}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          title="Open PRs"
          value={data.openPRs}
          trend="up"
          trendLabel="2 this week"
          subtext="Awaiting review"
          icon={GitPullRequest}
          sparklineData={[3, 5, 4, 6, 5, 7, data.openPRs]}
        />
        <Stat
          title="Open Issues"
          value={data.openIssues}
          trend="flat"
          trendLabel="steady"
          subtext="Across projects"
          icon={CircleDot}
          sparklineData={[18, 19, 18, 20, 19, data.openIssues, data.openIssues]}
        />
        <Stat
          title="Open Bugs"
          value={data.openBugs}
          trend="down"
          trendLabel="-12% vs last week"
          subtext="Bug backlog"
          icon={Bug}
          variant="warning"
          trendInverse
          sparklineData={[14, 13, 12, 10, data.openBugs]}
        />
        <Stat
          title="Lead Time"
          value="1.8d"
          trend="down"
          trendLabel="-0.3d"
          subtext="Target: 2d"
          icon={Timer}
          variant="success"
          sparklineData={[2.4, 2.2, 2.1, 1.9, 1.8]}
        />
      </div>

      <Predictions metrics={metrics} events={events} dataSource={dataSource} />

      <DataQuality metrics={metrics} dataSource={dataSource} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TrendChart
          title="Velocity Trend"
          subtitle="Story points / week"
          data={velocityData}
          dataSource="dummy"
        />
        <TrendChart
          title="Bug Backlog Trend"
          subtitle="Open bugs over time"
          data={bugData}
          color="#f59e0b"
          dataSource="dummy"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DataTable
          title="Blocked Tickets"
          subtitle="Jira items marked blocked"
          rows={blockedRows}
          maxRows={6}
          dataSource={dataSource}
        />
        <DataTable
          title="Security Alerts"
          subtitle="Dependabot / CVE findings"
          rows={cveRows}
          maxRows={6}
          dataSource={dataSource}
        />
      </div>
    </div>
  );
}
