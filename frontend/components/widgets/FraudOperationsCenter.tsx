"use client";

import { useMemo } from "react";
import { ShieldAlert, Activity, Scale, Users, AlertTriangle, CheckCircle } from "lucide-react";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { Stat } from "./Stat";
import { TrendChart } from "@/components/TrendChart";
import { DataTable } from "@/components/widgets/DataTable";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { DataTableRow } from "@/components/widgets/DataTable";

interface FraudOperationsCenterProps {
  metrics: any[];
  events: any[];
}

export function FraudOperationsCenter({ metrics, events }: FraudOperationsCenterProps) {
  const fraudRate = metrics.find((m) => m.metric_type === "fraud_rate")?.value ?? 0;
  const falsePositiveRate = metrics.find((m) => m.metric_type === "false_positive_rate")?.value ?? 0;
  const chargebackRate = metrics.find((m) => m.metric_type === "chargeback_rate")?.value ?? 0;
  const amlBacklog = metrics.find((m) => m.metric_type === "aml_alert_backlog")?.value ?? 0;

  const fraudTrend = useMemo(() => {
    return metrics
      .filter((m) => m.metric_type === "fraud_rate")
      .slice(0, 10)
      .map((m, i) => ({ label: `D${i + 1}`, value: m.value ?? 0 }))
      .reverse();
  }, [metrics]);

  const falsePositiveTrend = useMemo(() => {
    return metrics
      .filter((m) => m.metric_type === "false_positive_rate")
      .slice(0, 10)
      .map((m, i) => ({ label: `D${i + 1}`, value: m.value ?? 0 }))
      .reverse();
  }, [metrics]);

  const byKind = useMemo(() => {
    const map = new Map<string, number>();
    events
      .filter((e) => e.event_type === "fraud_ops_alert")
      .forEach((e) => {
        const kind = e.meta?.kind || "unknown";
        map.set(kind, (map.get(kind) || 0) + (e.meta?.cases || 0));
      });
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [events]);

  const openAlerts = events.filter((e) => e.event_type === "fraud_ops_alert" && e.status !== "resolved");
  const criticalOpen = openAlerts.filter((e) => e.severity === "critical").length;

  const alertRows: DataTableRow[] = openAlerts
    .sort((a, b) => (b.meta?.cases || 0) - (a.meta?.cases || 0))
    .slice(0, 6)
    .map((e) => ({
      id: e.id,
      label: e.title,
      meta: `${e.meta?.kind || "unknown"} · ${e.meta?.analyst || "unassigned"}`,
      status: `${e.meta?.cases || 0} cases`,
      severity: e.severity === "critical" ? "critical" : e.severity === "high" ? "high" : "medium",
    }));

  const frictionScore = useMemo(() => {
    // Simple heuristic: higher fraud + lower false positives = better
    const cappedFp = Math.min(falsePositiveRate, 10);
    const cappedFr = Math.min(fraudRate, 2);
    const score = Math.max(0, 100 - cappedFp * 8 - cappedFr * 15);
    return Math.round(score);
  }, [falsePositiveRate, fraudRate]);

  return (
    <Widget className="space-y-4">
      <WidgetHeader
        title="Fraud Operations Center"
        subtitle="Fraud losses, customer friction, AML backlog, and rule/model health"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          title="Fraud Rate"
          value={`${fraudRate.toFixed(2)}%`}
          icon={ShieldAlert}
          variant={fraudRate > 0.5 ? "warning" : "default"}
          trendInverse
          target="<0.5%"
        />
        <Stat
          title="False Positive Rate"
          value={`${falsePositiveRate.toFixed(2)}%`}
          icon={Activity}
          variant={falsePositiveRate > 2 ? "warning" : "success"}
          trendInverse
          target="<2%"
        />
        <Stat
          title="Chargeback Rate"
          value={`${chargebackRate.toFixed(2)}%`}
          icon={Scale}
          variant={chargebackRate > 0.1 ? "warning" : "success"}
          trendInverse
          target="<0.1%"
        />
        <Stat
          title="AML Backlog"
          value={Math.round(amlBacklog)}
          icon={Users}
          variant={amlBacklog > 50 ? "warning" : "default"}
          trendInverse
          target="<30"
        />
      </div>

      <div className={cn(
        "rounded-xl border p-4",
        frictionScore >= 80
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
          : frictionScore >= 60
          ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
          : "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40"
      )}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Risk-Friction Balance Score</p>
            <p className="text-xs text-muted-foreground">Higher is better — controls losses without blocking good customers</p>
          </div>
          <span className={cn(
            "text-2xl font-bold",
            frictionScore >= 80 ? "text-emerald-600" : frictionScore >= 60 ? "text-amber-600" : "text-rose-600"
          )}>{frictionScore}</span>
        </div>
        <Progress value={frictionScore} className="mt-3 h-2" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendChart
            title="Fraud Rate Trend"
            subtitle="% of transactions flagged as fraud"
            data={fraudTrend}
            type="area"
            color="#f43f5e"
            target={0.5}
            targetLabel="Target"
          />
        </div>
        <TrendChart
          title="False Positive Trend"
          subtitle="Good customers blocked"
          data={falsePositiveTrend}
          type="area"
          color="#f59e0b"
          target={2}
          targetLabel="Target"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TrendChart
          title="Alert Backlog by Type"
          subtitle="Open fraud/AML cases grouped by kind"
          data={byKind}
          type="bar"
          color="#6366f1"
        />
        <DataTable
          title="Open Fraud & AML Alerts"
          subtitle="Cases awaiting analyst review"
          rows={alertRows}
          maxRows={6}
          emptyText="No open fraud or AML alerts"
        />
      </div>

      {criticalOpen > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertTriangle size={16} />
          {criticalOpen} critical fraud/AML alert{criticalOpen > 1 ? "s" : ""} require immediate review.
        </div>
      )}
      {criticalOpen === 0 && openAlerts.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle size={16} />
          Fraud operations queue clear — no open alerts.
        </div>
      )}
    </Widget>
  );
}
