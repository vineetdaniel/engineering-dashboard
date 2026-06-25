"use client";

import { useMemo } from "react";
import { TrendingUp, AlertTriangle, DollarSign, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { Stat } from "./Stat";
import { TrendChart } from "@/components/TrendChart";
import { DataTable } from "@/components/widgets/DataTable";
import type { DataTableRow } from "@/components/widgets/DataTable";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CostAnomalyDetectionProps {
  metrics: any[];
  events: any[];
}

function zScore(values: number[]): number[] {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length) || 1;
  return values.map((v) => (v - mean) / std);
}

export function CostAnomalyDetection({ metrics, events }: CostAnomalyDetectionProps) {
  const spendSeries = useMemo(() => {
    const raw = metrics
      .filter((m) => m.metric_type === "cloud_spend_mtd")
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-14)
      .map((m) => m.value ?? 0);
    const scores = zScore(raw);
    return raw.map((value, i) => ({
      label: `D${i + 1}`,
      value,
      anomaly: Math.abs(scores[i]) > 1.5 ? scores[i] : 0,
    }));
  }, [metrics]);

  const anomalies = useMemo(() => {
    return spendSeries
      .filter((d) => Math.abs(d.anomaly) > 1.5)
      .map((d, i) => ({
        id: i,
        day: d.label,
        value: d.value,
        score: d.anomaly,
        direction: d.anomaly > 0 ? "up" : "down",
      }));
  }, [spendSeries]);

  const latest = spendSeries[spendSeries.length - 1] ?? { value: 0, anomaly: 0 };
  const previous = spendSeries[spendSeries.length - 2] ?? { value: 0 };
  const spendChange = previous.value > 0 ? ((latest.value - previous.value) / previous.value) * 100 : 0;
  const dayOfMonth = Math.max(1, new Date().getDate());
  const projectedMonthly = latest.value > 0 ? (latest.value * 30) / dayOfMonth : 0;

  const costDriverRows: DataTableRow[] = events
    .filter((e) => e.event_type === "cost_driver")
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      label: e.title,
      meta: `${e.entity} · $${e.meta?.spend ?? 0}`,
      status: e.status,
      severity: e.severity === "critical" ? "critical" : e.severity === "high" ? "high" : "medium",
    }));

  return (
    <Widget className="space-y-4">
      <WidgetHeader
        title="Cost Anomaly Detection"
        subtitle="Statistical outliers in cloud spend and top drivers"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          title="Latest MTD Spend"
          value={`$${(latest.value / 1000).toFixed(1)}k`}
          icon={DollarSign}
          trend={spendChange >= 0 ? "up" : "down"}
          trendLabel={`${Math.abs(spendChange).toFixed(1)}%`}
          trendInverse
          variant={spendChange > 15 ? "warning" : "default"}
          subtext="Month-to-date"
        />
        <Stat
          title="Anomalies"
          value={anomalies.length}
          icon={AlertTriangle}
          variant={anomalies.length > 0 ? "warning" : "success"}
          trendInverse
        />
        <Stat
          title="Max Z-Score"
          value={spendSeries.length ? Math.max(...spendSeries.map((d) => Math.abs(d.anomaly))).toFixed(1) : "0"}
          icon={Activity}
          variant={Math.max(...spendSeries.map((d) => Math.abs(d.anomaly))) > 2 ? "warning" : "success"}
          target="<2"
        />
        <Stat
          title="Projected Monthly"
          value={`$${(projectedMonthly / 1000).toFixed(0)}k`}
          icon={TrendingUp}
          subtext={`Based on ${dayOfMonth} days elapsed`}
        />
      </div>

      <TrendChart
        title="Cloud Spend Trend"
        subtitle="MTD spend series with anomaly cards below"
        data={spendSeries}
        type="bar"
        color="#10b981"
        className="h-56"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {anomalies.slice(0, 6).map((a) => {
          const Icon = a.direction === "up" ? ArrowUpRight : ArrowDownRight;
          return (
            <div
              key={a.id}
              className={cn(
                "flex items-center justify-between rounded-xl border p-3",
                a.direction === "up"
                  ? "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/50"
                  : "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/50"
              )}
            >
              <div>
                <p className="text-sm font-semibold text-foreground">{a.day}</p>
                <p className="text-xs text-muted-foreground">MTD ${(a.value / 1000).toFixed(1)}k</p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "gap-1",
                  a.direction === "up"
                    ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                    : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                )}
              >
                <Icon size={12} />
                Z {a.score.toFixed(1)}
              </Badge>
            </div>
          );
        })}
        {anomalies.length === 0 && (
          <div className="col-span-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
            No statistically significant cost anomalies in the selected window.
          </div>
        )}
      </div>

      <DataTable
        title="Top Cost Drivers"
        subtitle="Events flagged by billing"
        rows={costDriverRows}
        emptyText="No cost driver data available"
      />
    </Widget>
  );
}
