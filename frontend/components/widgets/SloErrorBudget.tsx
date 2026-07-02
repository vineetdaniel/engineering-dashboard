"use client";

import { useMemo } from "react";
import { Target, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SloErrorBudgetProps {
  metrics: any[];
  events: any[];
}

const DEFAULT_SLOS = [
  { service: "Payments API", target: 99.99, window: "30d" },
  { service: "Ledger", target: 99.97, window: "30d" },
  { service: "Auth Service", target: 99.95, window: "30d" },
  { service: "Webhooks", target: 99.9, window: "30d" },
  { service: "API Gateway", target: 99.95, window: "30d" },
];

export function SloErrorBudget({ metrics, events }: SloErrorBudgetProps) {
  const rows = useMemo(() => {
    return DEFAULT_SLOS.map((slo) => {
      const uptimeMetric = metrics
        .filter((m) => m.metric_type === "uptime_pct" && (m.entity === slo.service.toLowerCase().replace(/\s/g, "-") || m.meta?.service === slo.service))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      const errorMetric = metrics
        .filter((m) => m.metric_type === "error_rate_pct" && (m.entity === slo.service.toLowerCase().replace(/\s/g, "-") || m.meta?.service === slo.service))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

      const uptime = uptimeMetric?.value ?? slo.target;
      const errorRate = errorMetric?.value ?? 0.05;
      const errorBudgetUsed = Math.min(100, Math.max(0, ((slo.target - uptime) / (slo.target - 99)) * 100));
      const breached = uptime < slo.target;
      const breaches = events.filter((e) => e.event_type === "slo_breach" && (e.entity === slo.service || e.title.includes(slo.service))).length;

      return { ...slo, uptime, errorRate, errorBudgetUsed, breached, breaches };
    });
  }, [metrics, events]);

  return (
    <Widget>
      <WidgetHeader
        title="SLO / Error Budget"
        subtitle="Availability target vs. actual burn"
      />
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.service} className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {row.breached ? (
                  <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400" />
                ) : (
                  <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                )}
                <span className="text-sm font-semibold text-foreground">{row.service}</span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  row.breached
                    ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                    : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                )}
              >
                {row.breached ? "Budget exhausted" : "Healthy"}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-card p-2">
                <p className="text-muted-foreground">Target</p>
                <p className="font-bold text-foreground">{row.target.toFixed(2)}%</p>
              </div>
              <div className="rounded-lg bg-card p-2">
                <p className="text-muted-foreground">Actual</p>
                <p className={cn("font-bold", row.breached ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
                  {row.uptime.toFixed(2)}%
                </p>
              </div>
              <div className="rounded-lg bg-card p-2">
                <p className="text-muted-foreground">Error rate</p>
                <p className="font-bold text-foreground">{row.errorRate.toFixed(2)}%</p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Error budget used</span>
                <span className={cn("font-semibold", row.errorBudgetUsed > 80 ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>
                  {row.errorBudgetUsed.toFixed(1)}%
                </span>
              </div>
              <Progress
                value={row.errorBudgetUsed}
                className="h-2"
              />
            </div>

            {row.breaches > 0 && (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {row.breaches} SLO breach{row.breaches > 1 ? "es" : ""} this period
              </p>
            )}
          </div>
        ))}
      </div>
    </Widget>
  );
}
