"use client";

import { useMemo } from "react";
import { CreditCard, AlertTriangle, TrendingDown, Globe, Server } from "lucide-react";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { Stat } from "./Stat";
import { TrendChart } from "@/components/TrendChart";
import { DataTable } from "@/components/widgets/DataTable";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { DataTableRow } from "@/components/widgets/DataTable";

interface AuthorizationDeclineDrilldownProps {
  metrics: any[];
  events: any[];
}

export function AuthorizationDeclineDrilldown({ metrics, events }: AuthorizationDeclineDrilldownProps) {
  const declineRate = metrics.find((m) => m.metric_type === "authorization_decline_rate")?.value;
  const successRate = metrics.find((m) => m.metric_type === "payment_success_rate")?.value;
  const failoverCount = metrics.find((m) => m.metric_type === "processor_routing_failover_count")?.value ?? 0;

  const trend = useMemo(() => {
    return metrics
      .filter((m) => m.metric_type === "authorization_decline_rate")
      .slice(0, 10)
      .map((m, i) => ({ label: `D${i + 1}`, value: m.value ?? 0 }))
      .reverse();
  }, [metrics]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    events
      .filter((e) => e.event_type === "decline_code")
      .forEach((e) => {
        const key = e.meta?.category || "unknown";
        map.set(key, (map.get(key) || 0) + (e.meta?.count || 0));
      });
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [events]);

  const processorRows = useMemo(() => {
    const map = new Map<
      string,
      { count: number; fails: number; latency: number; region: string }
    >();
    events
      .filter((e) => e.event_type === "processor_status")
      .forEach((e) => {
        const p = e.meta?.processor || e.entity;
        const existing = map.get(p) || { count: 0, fails: 0, latency: 0, region: "" };
        existing.count += 1;
        if (e.status !== "healthy") existing.fails += 1;
        existing.latency = e.meta?.latency_ms || existing.latency;
        existing.region = e.meta?.region || existing.region;
        map.set(p, existing);
      });
    return Array.from(map.entries()).map(([processor, stats]) => ({
      processor,
      ...stats,
    }));
  }, [events]);

  const topDeclines: DataTableRow[] = events
    .filter((e) => e.event_type === "decline_code")
    .sort((a, b) => (b.meta?.count || 0) - (a.meta?.count || 0))
    .slice(0, 6)
    .map((e) => ({
      id: e.id,
      label: e.title,
      meta: `${e.meta?.processor || "unknown"} · ${e.meta?.region || "-"}`,
      status: e.meta?.category,
      severity: e.severity === "critical" ? "critical" : e.severity === "high" ? "high" : "medium",
    }));

  const failoversActive = processorRows.filter((p) => p.fails > 0).length;

  return (
    <Widget className="space-y-4">
      <WidgetHeader
        title="Authorization & Processor Health"
        subtitle="Decline-code drilldown and processor routing status"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          title="Decline Rate"
          value={declineRate != null ? `${declineRate.toFixed(2)}%` : "—"}
          icon={TrendingDown}
          variant={declineRate != null && declineRate > 5 ? "warning" : "default"}
          target="<5%"
          trendInverse
        />
        <Stat
          title="Auth Success"
          value={successRate != null ? `${successRate.toFixed(2)}%` : "—"}
          icon={CreditCard}
          variant={successRate != null && successRate < 99 ? "warning" : "success"}
          target=">99.5%"
        />
        <Stat
          title="Failover Events"
          value={failoverCount}
          icon={AlertTriangle}
          variant={failoverCount > 0 ? "warning" : "success"}
          trendInverse
        />
        <Stat
          title="Active Failovers"
          value={failoversActive}
          icon={Server}
          variant={failoversActive > 0 ? "danger" : "success"}
          trendInverse
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TrendChart
          title="Decline Rate Trend"
          subtitle="Authorization decline % over last 10 readings"
          data={trend}
          type="area"
          color="#f59e0b"
          target={5}
          targetLabel="Target"
        />
        <TrendChart
          title="Declines by Category"
          subtitle="Volume grouped by decline reason"
          data={byCategory}
          type="bar"
          color="#6366f1"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {processorRows.map((p) => {
          const healthy = p.fails === 0;
          return (
            <div
              key={p.processor}
              className={cn(
                "rounded-xl border p-3",
                healthy
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
                  : "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe size={14} className={healthy ? "text-emerald-600" : "text-rose-600"} />
                  <span className="text-sm font-semibold text-foreground">{p.processor.toUpperCase()}</span>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    healthy
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                      : "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                  )}
                >
                  {healthy ? "Healthy" : "Failover"}
                </Badge>
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Routing share</span>
                  <span>{p.count} samples · {p.latency}ms</span>
                </div>
                <Progress value={Math.min(100, (p.count / 10) * 100)} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground">Region: {p.region.toUpperCase()}</p>
              </div>
            </div>
          );
        })}
      </div>

      <DataTable
        title="Top Decline Codes"
        subtitle="By count, processor, and region"
        rows={topDeclines}
        maxRows={6}
        emptyText="No decline-code data available"
      />
    </Widget>
  );
}
