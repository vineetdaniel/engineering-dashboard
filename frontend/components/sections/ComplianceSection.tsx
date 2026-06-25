"use client";

import { ShieldCheck, FileWarning, CalendarDays, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import { SectionProps } from "./types";
import { SectionHeader } from "./SectionHeader";
import { Stat } from "@/components/widgets/Stat";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/widgets/DataTable";
import { TrendChart } from "@/components/TrendChart";
import { ComplianceWidget } from "@/components/widgets/ComplianceWidget";
import { ComplianceUploadPanel } from "@/components/widgets/ComplianceUploadPanel";
import { ComplianceControlsTable } from "@/components/widgets/ComplianceControlsTable";
import type { DataTableRow } from "@/components/widgets/DataTable";
import { cn } from "@/lib/utils";

const FRAMEWORKS = [
  { id: "soc2", name: "SOC 2 Type II", owner: "Compliance", target: 95 },
  { id: "pci", name: "PCI DSS", owner: "Security", target: 99 },
  { id: "iso27001", name: "ISO 27001", owner: "Security", target: 95 },
  { id: "gdpr", name: "GDPR", owner: "Legal", target: 95 },
  { id: "sox", name: "SOX ITGC", owner: "Finance", target: 98 },
];

export function ComplianceSection({ metrics, events, lastUpdated, dataSource }: SectionProps) {
  const uploadedFrameworks = metrics
    .filter((m) => m.metric_type === "compliance_control_status" && m.source === "compliance_manual")
    .reduce(
      (acc, m) => {
        const fw = String(m.meta?.framework || m.entity);
        if (!acc[fw]) acc[fw] = { total: 0, passed: 0, partial: 0 };
        acc[fw].total += 1;
        const status = String(m.meta?.status || "");
        if (status === "passed" || status === "compliant") acc[fw].passed += 1;
        else if (status === "partial") acc[fw].partial += 1;
        return acc;
      },
      {} as Record<string, { total: number; passed: number; partial: number }>
    );

  const frameworkScores = FRAMEWORKS.map((fw) => {
    const uploaded = uploadedFrameworks[fw.id];
    if (uploaded && uploaded.total > 0) {
      const score = Math.round(((uploaded.passed + uploaded.partial * 0.5) / uploaded.total) * 100);
      return { ...fw, progress: score };
    }
    const scoreMetric = metrics
      .filter((m) => m.metric_type === "compliance_framework_score" && (m.meta?.framework === fw.id || m.entity === fw.id))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    return { ...fw, progress: scoreMetric?.value ?? 0 };
  });

  const auditFindings = events.filter((e) => e.event_type === "audit_finding" || e.event_type === "compliance_control_status");
  const openFindings = auditFindings.filter((e) => e.status !== "resolved");
  const slaBreached = openFindings.filter((e) => e.severity === "critical" || e.severity === "high");
  const upcomingAudits = events.filter((e) => e.event_type === "audit" && e.status === "scheduled");

  const findingsRows: DataTableRow[] = openFindings.slice(0, 10).map((e) => ({
    id: e.id,
    label: e.title,
    meta: `${e.meta?.framework?.toUpperCase() || e.entity} · ${e.meta?.owner || "Unassigned"}`,
    status: e.status,
    severity: e.severity === "critical" ? "critical" : e.severity === "high" ? "high" : "medium",
  }));

  const evidenceProgress = FRAMEWORKS.map((fw) => {
    const total = metrics.filter((m) => m.metric_type === "compliance_evidence" && (m.meta?.framework === fw.id || m.entity === fw.id)).length || 12;
    const submitted = metrics.filter(
      (m) => m.metric_type === "compliance_evidence" && (m.meta?.framework === fw.id || m.entity === fw.id) && m.meta?.status === "submitted"
    ).length;
    return { framework: fw.name, pct: Math.round((submitted / total) * 100), submitted, total };
  });

  const complianceTrend = FRAMEWORKS.map((fw) => {
    const series = metrics
      .filter((m) => m.metric_type === "compliance_framework_score" && (m.meta?.framework === fw.id || m.entity === fw.id))
      .slice(0, 8)
      .reverse()
      .map((m, i) => ({ label: `W${i + 1}`, [fw.id]: m.value ?? 0 }));
    return { fw, series };
  });

  const mergedTrend = complianceTrend[0]?.series.map((point, i) => {
    const row: Record<string, number | string> = { label: point.label };
    complianceTrend.forEach(({ fw, series }) => {
      row[fw.id] = series[i]?.[fw.id] ?? 0;
    });
    return row;
  }) || [];

  const policyAcceptance = events.filter((e) => e.event_type === "policy_acceptance");
  const policyPending = policyAcceptance.filter((e) => e.status !== "completed").length;

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Compliance & Risk"
        description="Framework readiness, audit findings, and third-party risk"
        lastUpdated={lastUpdated}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          title="Open Findings"
          value={openFindings.length}
          icon={FileWarning}
          variant={openFindings.length > 5 ? "danger" : openFindings.length > 0 ? "warning" : "success"}
          trendInverse
          target="0"
        />
        <Stat
          title="SLA-Breached Findings"
          value={slaBreached.length}
          icon={AlertTriangle}
          variant={slaBreached.length > 0 ? "danger" : "success"}
          trendInverse
          target="0"
        />
        <Stat
          title="Upcoming Audits"
          value={upcomingAudits.length}
          icon={CalendarDays}
          variant={upcomingAudits.length > 3 ? "warning" : "success"}
          subtext="Next 90 days"
        />
        <Stat
          title="Policy Acceptance"
          value={policyPending}
          icon={Users}
          variant={policyPending > 0 ? "warning" : "success"}
          trendInverse
          target="0"
          subtext="Pending acknowledgements"
        />
      </div>

      <ComplianceUploadPanel onUpload={() => window.location.reload()} />

      <ComplianceWidget
        frameworks={frameworkScores.map((fw) => ({
          id: fw.id,
          name: fw.name,
          status: fw.progress >= fw.target ? "compliant" : fw.progress >= fw.target - 10 ? "at_risk" : "non_compliant",
          progress: Math.round(fw.progress),
          nextAudit: "Q3 2026",
          owner: fw.owner,
        }))}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Widget dataSource={dataSource}>
          <WidgetHeader title="Evidence Collection" subtitle="Controls with submitted evidence by framework" dataSource={dataSource} />
          <div className="space-y-4">
            {evidenceProgress.map((item) => (
              <div key={item.framework} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{item.framework}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.submitted}/{item.total} ({item.pct}%)
                  </span>
                </div>
                <Progress value={item.pct} className="h-2" />
              </div>
            ))}
          </div>
        </Widget>

        <Widget dataSource={dataSource}>
          <WidgetHeader title="Upcoming Audit Calendar" subtitle="Scheduled reviews and renewals" dataSource={dataSource} />
          <div className="space-y-3">
            {upcomingAudits.length === 0 && (
              <p className="text-sm text-muted-foreground">No scheduled audits in the selected window.</p>
            )}
            {upcomingAudits.slice(0, 6).map((audit) => (
              <div
                key={audit.id}
                className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    <CalendarDays size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{audit.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {audit.meta?.framework?.toUpperCase() || audit.entity} · {audit.meta?.owner || "TBD"}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={cn("text-xs", statusClass(audit.status))}>
                  {audit.status}
                </Badge>
              </div>
            ))}
          </div>
        </Widget>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DataTable
            title="Open Audit Findings"
            subtitle="Findings requiring remediation or evidence"
            rows={findingsRows}
            dataSource={dataSource}
            emptyText="No open findings — all controls green"
          />
        </div>
        <Widget dataSource={dataSource}>
          <WidgetHeader title="Framework Readiness Trend" subtitle="Score over last 8 weeks" dataSource={dataSource} />
          {mergedTrend.length > 1 ? (
            <TrendChart
              title=""
              data={mergedTrend}
              dataSource={dataSource}
              type="composed"
              series={FRAMEWORKS.map((fw) => ({
                key: fw.id,
                label: fw.name,
                color: frameworkColor(fw.id),
                type: "area",
              }))}
              className="h-64"
            />
          ) : (
            <div className="flex h-48 items-center justify-center">
              <p className="text-sm text-muted-foreground">Not enough historical compliance data.</p>
            </div>
          )}
        </Widget>
      </div>

      <ComplianceControlsTable metrics={metrics} dataSource={dataSource} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Widget dataSource={dataSource}>
            <WidgetHeader title="Policy & Training Status" subtitle="Acknowledgement and completion tracking" dataSource={dataSource} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {["Security policy", "Code of conduct", "PCI handling", "Incident response", "GDPR training", "SOX controls"].map((policy, i) => {
                const completed = policyAcceptance.filter((e) => e.title.includes(policy) && e.status === "completed").length;
                const total = 8;
                const pct = Math.round((completed / total) * 100);
                return (
                  <div key={policy} className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
                    <div className="flex items-center gap-3">
                      {pct >= 100 ? (
                        <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
                      )}
                      <span className="text-sm font-medium text-foreground">{policy}</span>
                    </div>
                    <span className="text-sm font-bold text-foreground">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </Widget>
        </div>

        <Widget dataSource={dataSource}>
          <WidgetHeader title="Compliance Quick Actions" subtitle="Common CTO workflows" dataSource={dataSource} />
          <div className="space-y-2">
            {["Download SOC 2 evidence pack", "Schedule access review", "Export audit finding report", "Rotate third-party API keys"].map(
              (action) => (
                <button
                  key={action}
                  className="w-full rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-left text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  {action}
                </button>
              )
            )}
          </div>
        </Widget>
      </div>
    </div>
  );
}

function statusClass(status: string) {
  switch (status) {
    case "resolved":
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";
    case "scheduled":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300";
    case "open":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300";
    default:
      return "border-border bg-muted text-foreground";
  }
}

function frameworkColor(id: string) {
  const map: Record<string, string> = {
    soc2: "#6366f1",
    pci: "#10b981",
    iso27001: "#0ea5e9",
    gdpr: "#f59e0b",
    sox: "#8b5cf6",
  };
  return map[id] || "#6366f1";
}
