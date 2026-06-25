"use client";

import { useMemo } from "react";
import { Scale, AlertTriangle, Clock, CheckCircle, DollarSign } from "lucide-react";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { Stat } from "./Stat";
import { TrendChart } from "@/components/TrendChart";
import { DataTable } from "@/components/widgets/DataTable";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { DataTableRow } from "@/components/widgets/DataTable";

interface ReconciliationExceptionsProps {
  metrics: any[];
  events: any[];
}

export function ReconciliationExceptions({ metrics, events }: ReconciliationExceptionsProps) {
  const exceptionCount = metrics.find((m) => m.metric_type === "reconciliation_exception_count")?.value ?? 0;
  const ledgerImbalance = metrics.find((m) => m.metric_type === "ledger_imbalance")?.value ?? 0;
  const reconLag = metrics.find((m) => m.metric_type === "reconciliation_lag_minutes")?.value ?? 0;

  const trend = useMemo(() => {
    return metrics
      .filter((m) => m.metric_type === "reconciliation_exception_count")
      .slice(0, 10)
      .map((m, i) => ({ label: `D${i + 1}`, value: m.value ?? 0 }))
      .reverse();
  }, [metrics]);

  const byReason = useMemo(() => {
    const map = new Map<string, { count: number; amount: number } >();
    events
      .filter((e) => e.event_type === "reconciliation_exception")
      .forEach((e) => {
        const reason = e.meta?.reason || "unknown";
        const existing = map.get(reason) || { count: 0, amount: 0 };
        existing.count += 1;
        existing.amount += e.meta?.amount || 0;
        map.set(reason, existing);
      });
    return Array.from(map.entries())
      .map(([label, stats]) => ({ label, value: stats.count, amount: stats.amount }))
      .sort((a, b) => b.value - a.value);
  }, [events]);

  const agingBuckets = useMemo(() => {
    const open = events.filter((e) => e.event_type === "reconciliation_exception" && e.status !== "resolved");
    return {
      "<24h": open.filter((e) => (e.meta?.age_hours || 0) < 24).length,
      "24-48h": open.filter((e) => {
        const age = e.meta?.age_hours || 0;
        return age >= 24 && age < 48;
      }).length,
      "48-72h": open.filter((e) => {
        const age = e.meta?.age_hours || 0;
        return age >= 48 && age < 72;
      }).length,
      ">72h": open.filter((e) => (e.meta?.age_hours || 0) >= 72).length,
    };
  }, [events]);

  const openExceptions = events.filter((e) => e.event_type === "reconciliation_exception" && e.status !== "resolved");
  const totalAtRisk = openExceptions.reduce((sum, e) => sum + (e.meta?.amount || 0), 0);

  const exceptionRows: DataTableRow[] = openExceptions
    .sort((a, b) => (b.meta?.amount || 0) - (a.meta?.amount || 0))
    .slice(0, 6)
    .map((e) => ({
      id: e.id,
      label: e.title,
      meta: `${e.meta?.currency || "USD"} ${(e.meta?.amount || 0).toLocaleString()} · ${e.meta?.reason || "unknown"}`,
      status: `${e.meta?.age_hours || 0}h`,
      severity: e.severity === "critical" ? "critical" : e.severity === "high" ? "high" : "medium",
    }));

  return (
    <Widget className="space-y-4">
      <WidgetHeader
        title="Reconciliation & Ledger Integrity"
        subtitle="Exception queue, aging, and financial exposure"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          title="Open Exceptions"
          value={exceptionCount}
          icon={Scale}
          variant={exceptionCount > 20 ? "warning" : "default"}
          trendInverse
          target="<10"
        />
        <Stat
          title="Ledger Imbalance"
          value={`$${ledgerImbalance.toLocaleString()}`}
          icon={DollarSign}
          variant={ledgerImbalance > 1000 ? "warning" : "success"}
          trendInverse
          target="$0"
        />
        <Stat
          title="Recon Lag"
          value={`${Math.round(reconLag)}m`}
          icon={Clock}
          variant={reconLag > 60 ? "warning" : "success"}
          trendInverse
          target="<30m"
        />
        <Stat
          title="Exposure at Risk"
          value={`$${Math.round(totalAtRisk).toLocaleString()}`}
          icon={AlertTriangle}
          variant={totalAtRisk > 10000 ? "warning" : "default"}
          trendInverse
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TrendChart
          title="Exception Queue Trend"
          subtitle="Open reconciliation exceptions over time"
          data={trend}
          type="area"
          color="#f43f5e"
          target={10}
          targetLabel="Target"
        />
        <TrendChart
          title="Exceptions by Reason"
          subtitle="Count grouped by root cause"
          data={byReason.map((r) => ({ label: r.label, value: r.value }))}
          type="bar"
          color="#0ea5e9"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Aging Buckets</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(agingBuckets).map(([bucket, count]) => {
            const pct = Math.max(0, (count / Math.max(1, openExceptions.length)) * 100);
            const bad = bucket === ">72h" && count > 0;
            return (
              <div
                key={bucket}
                className={cn(
                  "rounded-xl border p-3",
                  bad
                    ? "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40"
                    : "border-border bg-muted/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{bucket}</span>
                  <Badge variant="outline" className="text-[10px]">{count}</Badge>
                </div>
                <Progress
                  value={pct}
                  className={cn("mt-2 h-1.5", bad && "[&>div]:bg-rose-500")}
                />
              </div>
            );
          })}
        </div>
      </div>

      <DataTable
        title="Largest Open Exceptions"
        subtitle="By financial exposure and age"
        rows={exceptionRows}
        maxRows={6}
        emptyText="No open reconciliation exceptions"
      />

      {totalAtRisk <= 1000 && openExceptions.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle size={16} />
          Ledger reconciled — no material exceptions outstanding.
        </div>
      )}
    </Widget>
  );
}
