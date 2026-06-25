"use client";

import { ShieldAlert, Lock, FileCheck } from "lucide-react";
import { SectionProps } from "./types";
import { SectionHeader } from "./SectionHeader";
import { Stat } from "@/components/widgets/Stat";
import { TrendChart } from "@/components/TrendChart";
import { DataTable } from "@/components/widgets/DataTable";
import { Timeline } from "@/components/widgets/Timeline";
import { ComplianceWidget } from "@/components/widgets/ComplianceWidget";
import { SecurityRemediation } from "@/components/widgets/SecurityRemediation";
import { SecurityPosture } from "@/components/widgets/SecurityPosture";
import { SecretsTable } from "@/components/widgets/SecretsTable";
import { AuditReadiness } from "@/components/widgets/AuditReadiness";
import { PrivilegedAccess } from "@/components/widgets/PrivilegedAccess";
import type { DataTableRow } from "@/components/widgets/DataTable";
import type { TimelineEvent } from "@/components/widgets/Timeline";

const complianceControls = [
  { label: "Access reviews", value: 92 },
  { label: "Encryption at rest", value: 100 },
  { label: "Penetration test remediations", value: 78 },
  { label: "Vendor risk assessments", value: 65 },
];

export function SecuritySection({ data, metrics, events, lastUpdated, dataSource }: SectionProps) {
  const cveRows: DataTableRow[] = data.cves.slice(0, 20).map((e) => ({
    id: e.id,
    label: e.title,
    meta: e.entity,
    status: e.status,
    severity: e.severity,
  }));

  const severityCounts = {
    critical: data.cves.filter((e) => e.severity === "critical").length,
    high: data.cves.filter((e) => e.severity === "high").length,
    medium: data.cves.filter((e) => e.severity === "medium").length,
    low: data.cves.filter((e) => e.severity === "low").length,
  };

  const severityDistribution = [
    { label: "Critical", value: severityCounts.critical },
    { label: "High", value: severityCounts.high },
    { label: "Medium", value: severityCounts.medium },
    { label: "Low", value: severityCounts.low },
  ];

  // SLA breach heuristic: critical open > 7 days, high open > 30 days
  const slaBreaches = data.cves.filter((e) => {
    if (!e.created_at) return false;
    const ageDays = (Date.now() - new Date(e.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return (e.severity === "critical" && ageDays > 7) || (e.severity === "high" && ageDays > 30);
  });

  const secretsFindings = events.filter((e) => e.event_type === "secret_scanning_alert");

  const recentAlerts: TimelineEvent[] = data.cves
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      title: e.title,
      timestamp: e.created_at || new Date().toISOString(),
      severity: e.severity,
      status: e.status,
      description: e.entity,
    }));

  const auditRows: DataTableRow[] = events
    .filter((e) => e.event_type === "audit_log")
    .slice(0, 8)
    .map((e) => ({
      id: e.id,
      label: e.title,
      meta: `${e.meta?.actor || "system"} · ${e.entity}`,
      status: e.status,
      severity: e.severity === "critical" ? "critical" : e.severity === "high" ? "high" : "medium",
    }));

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Security & Compliance"
        description="CVEs, secrets scanning, and control status"
        lastUpdated={lastUpdated}
      />

      <SecurityPosture cves={data.cves} events={events} />

      <PrivilegedAccess events={events} />

      <AuditReadiness metrics={metrics} events={events} dataSource={dataSource} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          title="Open CVEs"
          value={data.cves.length}
          icon={ShieldAlert}
          variant={data.cves.length > 10 ? "danger" : "warning"}
          trendInverse
          target="<10"
        />
        <Stat
          title="Critical"
          value={data.criticalCount}
          icon={ShieldAlert}
          variant={data.criticalCount > 0 ? "danger" : "success"}
          trendInverse
          target="0"
        />
        <Stat
          title="Secrets Findings"
          value={secretsFindings.length}
          icon={Lock}
          variant={secretsFindings.length > 0 ? "danger" : "success"}
          trendInverse
          target="0"
        />
        <Stat
          title="SLA Breaches"
          value={slaBreaches.length}
          icon={FileCheck}
          variant={slaBreaches.length > 0 ? "warning" : "success"}
          trendInverse
          target="0"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendChart
            title="CVE Severity Distribution"
            subtitle="Open findings by severity"
            data={severityDistribution}
            dataSource={dataSource}
            type="bar"
            color="#f43f5e"
          />
        </div>
        <ComplianceWidget />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TrendChart
          title="Compliance Control Pass Rate"
          subtitle="% controls passing"
          data={complianceControls}
          dataSource={dataSource}
          type="bar"
          target={90}
          targetLabel="Target"
          color="#6366f1"
        />
        <DataTable
          title="Dependabot Alerts"
          subtitle="CVE findings by repository"
          rows={cveRows}
          maxRows={8}
          dataSource={dataSource}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SecretsTable events={events} dataSource={dataSource} maxRows={8} />
        <SecurityRemediation cves={data.cves} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Timeline
          title="Recent CVEs"
          subtitle="Latest open findings"
          events={recentAlerts}
          maxEvents={5}
        />
        <DataTable
          title="Audit Log"
          subtitle="Recent security and compliance changes"
          rows={auditRows}
          maxRows={8}
          dataSource={dataSource}
          emptyText="No audit events in selected window"
        />
      </div>
    </div>
  );
}
