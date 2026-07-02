"use client";

import { Activity, Zap, Timer, Server, Users } from "lucide-react";
import { SectionProps } from "./types";
import { SectionHeader } from "./SectionHeader";
import { Stat } from "@/components/widgets/Stat";
import { TrendChart } from "@/components/TrendChart";
import { Timeline } from "@/components/widgets/Timeline";
import { DataTable } from "@/components/widgets/DataTable";
import { IncidentCommandCenter } from "@/components/widgets/IncidentCommandCenter";
import { IncidentResponseMetrics } from "@/components/widgets/IncidentResponseMetrics";
import { IncidentLifecycle } from "@/components/widgets/IncidentLifecycle";
import { RunbookQuickLinks } from "@/components/widgets/RunbookQuickLinks";
import { VendorHealth } from "@/components/widgets/VendorHealth";
import { VendorRiskRegister } from "@/components/widgets/VendorRiskRegister";
import { DRReadiness } from "@/components/widgets/DRReadiness";
import { ReleaseTimeline } from "@/components/widgets/ReleaseTimeline";
import { OnCallRotation } from "@/components/widgets/OnCallRotation";
import { CustomerImpact } from "@/components/widgets/CustomerImpact";
import { PostIncidentActions } from "@/components/widgets/PostIncidentActions";
import { ServiceDependencyGrid } from "@/components/widgets/ServiceDependencyGrid";
import { SloErrorBudget } from "@/components/widgets/SloErrorBudget";
import { BackupDRStatus } from "@/components/widgets/BackupDRStatus";
import { ApiGatewaySecurity } from "@/components/widgets/ApiGatewaySecurity";
import { ChangeManagement } from "@/components/widgets/ChangeManagement";
import { LiveActivityFeed } from "@/components/widgets/LiveActivityFeed";
import { Widget, WidgetHeader } from "@/components/widgets";
import type { TimelineEvent, DataTableRow } from "@/components/widgets";

export function OperationsSection({ data, metrics, events, filters, lastUpdated, dataSource }: SectionProps) {
  // Read real metrics when available; fall back to sensible sample data
  const uptimeVal = metrics.find((m) => m.metric_type === "uptime_pct")?.value;
  const openIncidents = events.filter((e) => e.event_type === "incident" && e.status !== "resolved").length;
  const p95Latency = metrics.find((m) => m.metric_type === "p95_latency_ms")?.value;
  const errorRate = metrics.find((m) => m.metric_type === "error_rate_pct")?.value;

  const latencySeries: Record<string, string | number>[] =
    metrics
      .filter((m) => m.metric_type === "p95_latency_ms")
      .slice(0, 12)
      .map((m, i) => ({ label: `${i}:00`, value: m.value ?? 0 }))
      .length > 2
      ? metrics.filter((m) => m.metric_type === "p95_latency_ms").slice(0, 12).map((m, i) => ({ label: `${i}:00`, value: m.value ?? 0 }))
      : [
          { label: "00:00", value: 112 },
          { label: "04:00", value: 118 },
          { label: "08:00", value: 145 },
          { label: "12:00", value: 128 },
          { label: "16:00", value: 124 },
          { label: "20:00", value: 120 },
        ];

  const errorSeries: Record<string, string | number>[] =
    metrics
      .filter((m) => m.metric_type === "error_rate_pct")
      .slice(0, 12)
      .map((m, i) => ({ label: `${i}:00`, value: m.value ?? 0 }))
      .length > 2
      ? metrics.filter((m) => m.metric_type === "error_rate_pct").slice(0, 12).map((m, i) => ({ label: `${i}:00`, value: m.value ?? 0 }))
      : [
          { label: "00:00", value: 0.12 },
          { label: "04:00", value: 0.15 },
          { label: "08:00", value: 0.22 },
          { label: "12:00", value: 0.14 },
          { label: "16:00", value: 0.11 },
          { label: "20:00", value: 0.1 },
        ];

  const sloRows: DataTableRow[] = events
    .filter((e) => e.event_type === "slo_breach")
    .slice(0, 6)
    .map((e) => ({
      id: e.id,
      label: e.title,
      meta: e.entity,
      status: e.status,
      severity: e.severity === "critical" ? "critical" : e.severity === "high" ? "high" : "medium",
    }));

  const activeIncidents = events.filter((e) => e.event_type === "incident" && e.status !== "resolved");
  const releases = events.filter((e) => e.event_type === "release_deploy");

  const services = [
    { name: "Payments API", uptime: 99.99, status: "healthy" as const },
    { name: "Ledger", uptime: 99.97, status: "healthy" as const },
    { name: "Auth", uptime: 99.95, status: "warning" as const },
    { name: "Webhooks", uptime: 99.92, status: "warning" as const },
    { name: "Dashboard", uptime: 100, status: "healthy" as const },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Operational Excellence"
        description="Uptime, incidents, latency, and error rates"
        lastUpdated={lastUpdated}
      />

      <IncidentCommandCenter incidents={activeIncidents} dataSource={dataSource} />

      <RunbookQuickLinks activeIncidentCount={activeIncidents.length} />

      <IncidentResponseMetrics events={events} />

      <IncidentLifecycle events={events} maxIncidents={4} />

      <CustomerImpact metrics={metrics} events={events} />

      <ServiceDependencyGrid metrics={metrics} events={events} />

      <VendorHealth metrics={metrics} events={events} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ApiGatewaySecurity metrics={metrics} events={events} />
        </div>
        <SloErrorBudget metrics={metrics} events={events} />
      </div>

      <BackupDRStatus events={events} />

      <DRReadiness metrics={metrics} events={events} />

      <VendorRiskRegister metrics={metrics} events={events} />

      <ChangeManagement events={events} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          title="Uptime"
          value={uptimeVal != null ? `${uptimeVal.toFixed(2)}%` : "99.97%"}
          icon={Activity}
          variant={uptimeVal != null && uptimeVal < 99.9 ? "warning" : "success"}
          subtext="Last 30 days"
          target=">99.9%"
        />
        <Stat
          title="Open Incidents"
          value={openIncidents}
          icon={Zap}
          variant={openIncidents > 0 ? "danger" : "success"}
          trendInverse
          target="0"
        />
        <Stat
          title="P95 Latency"
          value={p95Latency != null ? `${p95Latency}ms` : "124ms"}
          trend="down"
          trendLabel="-8ms"
          icon={Timer}
          variant="success"
          target="<150ms"
          sparklineData={[145, 138, 132, 128, p95Latency ?? 124]}
        />
        <Stat
          title="Error Rate"
          value={errorRate != null ? `${errorRate}%` : "0.12%"}
          trend="down"
          trendLabel="-0.05%"
          icon={Server}
          variant="success"
          target="<0.2%"
          sparklineData={[0.22, 0.18, 0.15, 0.13, errorRate ?? 0.12]}
        />
      </div>

      <Widget dataSource={dataSource}>
        <WidgetHeader title="Service Uptime / SLO Status" subtitle="Critical services over last 30 days" dataSource={dataSource} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {services.map((svc) => (
            <div
              key={svc.name}
              className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{svc.name}</p>
                <p className={`text-xs ${svc.status === "healthy" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {svc.status === "healthy" ? "Healthy" : "Degraded"}
                </p>
              </div>
              <span className="text-lg font-bold text-foreground">{svc.uptime.toFixed(2)}%</span>
            </div>
          ))}
        </div>
      </Widget>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TrendChart
          title="P95 Latency"
          subtitle="Milliseconds over time"
          data={latencySeries}
          dataSource={dataSource}
          target={150}
          targetLabel="SLO"
          color="#0ea5e9"
        />
        <TrendChart
          title="Error Rate"
          subtitle="% of total requests"
          data={errorSeries}
          dataSource={dataSource}
          target={0.2}
          targetLabel="SLO"
          color="#f59e0b"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <LiveActivityFeed filters={filters} maxEvents={8} />
        <ReleaseTimeline releases={releases} dataSource={dataSource} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DataTable
          title="SLO Breaches"
          subtitle="Services missing their SLO targets"
          rows={sloRows}
          dataSource={dataSource}
          emptyText="No SLO breaches — all services healthy"
        />
        <Timeline
          title="Vendor Incidents"
          subtitle="Third-party service disruptions"
          events={events
            .filter((e) => e.event_type === "vendor_incident")
            .slice(0, 6)
            .map((e) => ({
              id: e.id,
              title: e.title,
              timestamp: e.happened_at || new Date().toISOString(),
              severity: e.severity,
              status: e.status,
              description: e.entity,
            }))}
          maxEvents={6}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PostIncidentActions events={events} />
        </div>
        <OnCallRotation />
      </div>

      <Widget dataSource={dataSource}>
        <WidgetHeader title="On-Call Load Distribution" subtitle="Incidents per on-call engineer this week" dataSource={dataSource} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {["Alex", "Priya", "Jordan", "Sam", "Casey", "Taylor"].map((name, i) => (
            <div key={name} className="flex flex-col items-center rounded-xl border border-border bg-muted/40 px-3 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-bold">
                {name[0]}
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">{name}</p>
              <p className="text-xs text-muted-foreground">{[2, 1, 3, 0, 1, 2][i]} incidents</p>
            </div>
          ))}
        </div>
      </Widget>
    </div>
  );
}
