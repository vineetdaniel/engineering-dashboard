"use client";

import { useMemo } from "react";
import { ShieldCheck, AlertTriangle, Calendar, FileText, Server, ExternalLink } from "lucide-react";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { DataTable } from "@/components/widgets/DataTable";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { DataTableRow } from "@/components/widgets/DataTable";

interface VendorRiskRegisterProps {
  metrics: any[];
  events: any[];
}

interface VendorEntry {
  name: string;
  score: number;
  criticality: "critical" | "high" | "medium";
  function: string;
  certifications: string[];
  contractRenewal: string;
  sla: string;
  openIncidents: number;
  rcaCompleted: number;
  rcaTotal: number;
}

const VENDOR_META: Record<string, Partial<VendorEntry>> = {
  stripe: {
    criticality: "critical",
    function: "Payment processing",
    certifications: ["PCI DSS Level 1", "SOC 2 Type II"],
    contractRenewal: "2026-09-15",
    sla: "99.99%",
  },
  plaid: {
    criticality: "critical",
    function: "Bank linking / AHC",
    certifications: ["SOC 2 Type II"],
    contractRenewal: "2026-11-02",
    sla: "99.9%",
  },
  auth0: {
    criticality: "high",
    function: "Identity / SSO",
    certifications: ["SOC 2 Type II", "ISO 27001"],
    contractRenewal: "2026-08-20",
    sla: "99.9%",
  },
  sendgrid: {
    criticality: "medium",
    function: "Email delivery",
    certifications: ["SOC 2 Type II"],
    contractRenewal: "2026-12-10",
    sla: "99.9%",
  },
  "aws-us-east-1": {
    criticality: "critical",
    function: "Cloud infrastructure",
    certifications: ["SOC 2 Type II", "ISO 27001", "PCI DSS"],
    contractRenewal: "2027-01-01",
    sla: "99.99%",
  },
  adyen: {
    criticality: "high",
    function: "Payment processor failover",
    certifications: ["PCI DSS Level 1", "SOC 2 Type II"],
    contractRenewal: "2026-10-05",
    sla: "99.99%",
  },
  braintree: {
    criticality: "medium",
    function: "Payment processor failover",
    certifications: ["PCI DSS Level 1"],
    contractRenewal: "2026-07-30",
    sla: "99.9%",
  },
};

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function criticalityColor(c: string) {
  return c === "critical"
    ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
    : c === "high"
    ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
    : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300";
}

export function VendorRiskRegister({ metrics, events }: VendorRiskRegisterProps) {
  const vendorScores = useMemo(() => {
    const map = new Map<string, number>();
    metrics
      .filter((m) => m.metric_type === "vendor_health_score")
      .forEach((m) => {
        const name = m.meta?.vendor || m.entity;
        map.set(name, m.value ?? 0);
      });
    return map;
  }, [metrics]);

  const vendorIncidents = events.filter((e) => e.event_type === "vendor_incident");

  const vendors: VendorEntry[] = useMemo(() => {
    const names = Array.from(new Set([...vendorScores.keys(), ...Object.keys(VENDOR_META)]));
    return names.map((name) => {
      const meta = VENDOR_META[name] || {};
      const incidents = vendorIncidents.filter((e) => e.entity === name || e.meta?.vendor === name);
      const open = incidents.filter((e) => e.status !== "resolved").length;
      const total = incidents.length;
      const resolved = incidents.filter((e) => e.status === "resolved");
      const rcaTotal = resolved.length;
      const rcaCompleted = resolved.filter((e) => e.meta?.rca === "completed").length;
      return {
        name,
        score: vendorScores.get(name) ?? 0,
        criticality: (meta.criticality as any) || "medium",
        function: meta.function || "Integration",
        certifications: meta.certifications || [],
        contractRenewal: meta.contractRenewal || "2026-12-31",
        sla: meta.sla || "99.9%",
        openIncidents: open,
        rcaCompleted,
        rcaTotal,
      };
    });
  }, [vendorScores, vendorIncidents]);

  const registerRows: DataTableRow[] = vendors.map((v) => ({
    id: v.name,
    label: v.name.toUpperCase(),
    meta: `${v.function} · SLA ${v.sla}`,
    status: v.criticality,
    severity: v.criticality,
  }));

  const overdueRenewals = vendors.filter((v) => daysUntil(v.contractRenewal) < 60);
  const missingCerts = vendors.filter((v) => v.certifications.length === 0);

  return (
    <Widget className="space-y-4">
      <WidgetHeader
        title="Vendor Risk Register"
        subtitle="Criticality, contracts, certifications, and incident RCA status"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Critical vendors</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{vendors.filter((v) => v.criticality === "critical").length}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Open incidents</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{vendors.reduce((a, v) => a + v.openIncidents, 0)}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Renewals &lt;60d</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{overdueRenewals.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Missing certs</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{missingCerts.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {vendors.map((v) => {
          const renewalDays = daysUntil(v.contractRenewal);
          const rcaPct = v.rcaTotal > 0 ? Math.round((v.rcaCompleted / v.rcaTotal) * 100) : 100;
          return (
            <div key={v.name} className="rounded-xl border border-border bg-card p-4 transition hover:bg-muted/40">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <Server size={14} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium capitalize">{v.name.replace(/-/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">{v.function}</p>
                  </div>
                </div>
                <Badge variant="outline" className={criticalityColor(v.criticality)}>
                  {v.criticality}
                </Badge>
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Health score</span>
                  <span className="font-medium">{v.score.toFixed(1)}%</span>
                </div>
                <Progress value={v.score} className="h-2" />

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">SLA</span>
                  <span className="font-medium">{v.sla}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Calendar size={12} />
                    Renewal
                  </span>
                  <span className={cn("font-medium", renewalDays < 60 ? "text-rose-600" : "text-foreground")}>
                    {renewalDays}d
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <ShieldCheck size={12} />
                    Certs
                  </span>
                  <span className="font-medium">{v.certifications.join(", ") || "—"}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <FileText size={12} />
                    RCA coverage
                  </span>
                  <span className="font-medium">{rcaPct}%</span>
                </div>
                {v.openIncidents > 0 && (
                  <div className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400">
                    <AlertTriangle size={12} />
                    {v.openIncidents} active incident{v.openIncidents > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <DataTable
        title="Vendor Register Summary"
        subtitle="Criticality, function, and SLA at a glance"
        rows={registerRows}
        maxRows={8}
        emptyText="No vendor data available"
      />
    </Widget>
  );
}
