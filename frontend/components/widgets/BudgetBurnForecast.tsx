"use client";

import { useMemo } from "react";
import { Wallet, Calendar, Flame, TrendingUp, AlertTriangle } from "lucide-react";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { Stat } from "./Stat";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface BudgetBurnForecastProps {
  metrics: any[];
}

export function BudgetBurnForecast({ metrics }: BudgetBurnForecastProps) {
  const mtdSpend = metrics.find((m) => m.metric_type === "cloud_spend_mtd")?.value ?? 0;
  const monthlyBudget = metrics.find((m) => m.metric_type === "monthly_budget")?.value ?? 0;
  const budgetUsedPct = metrics.find((m) => m.metric_type === "budget_used_pct")?.value ?? 0;

  const dayOfMonth = Math.max(1, new Date().getDate());
  const daysInMonth = 30;
  const daysRemaining = Math.max(0, daysInMonth - dayOfMonth);

  const projectedMonthly = useMemo(() => {
    if (mtdSpend <= 0 || dayOfMonth <= 0) return 0;
    return (mtdSpend / dayOfMonth) * daysInMonth;
  }, [mtdSpend, dayOfMonth]);

  const effectiveBudget = monthlyBudget > 0 ? monthlyBudget : (mtdSpend / Math.max(1, budgetUsedPct)) * 100;
  const projectedPct = effectiveBudget > 0 ? (projectedMonthly / effectiveBudget) * 100 : 0;
  const budgetRemaining = Math.max(0, effectiveBudget - mtdSpend);
  const plannedDailyBurn = effectiveBudget / daysInMonth;
  const actualDailyBurn = mtdSpend / dayOfMonth;
  const burnRatio = plannedDailyBurn > 0 ? actualDailyBurn / plannedDailyBurn : 0;

  let status: "on-track" | "caution" | "overspend" = "on-track";
  if (projectedPct > 105) status = "overspend";
  else if (projectedPct > 90) status = "caution";

  const statusConfig = {
    "on-track": {
      label: "On Track",
      color: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-200 dark:border-emerald-900",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      progress: "bg-emerald-500",
    },
    caution: {
      label: "Caution",
      color: "text-amber-600 dark:text-amber-400",
      border: "border-amber-200 dark:border-amber-900",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      progress: "bg-amber-500",
    },
    overspend: {
      label: "Overspend Risk",
      color: "text-rose-600 dark:text-rose-400",
      border: "border-rose-200 dark:border-rose-900",
      bg: "bg-rose-50 dark:bg-rose-950/40",
      progress: "bg-rose-500",
    },
  }[status];

  return (
    <Widget className="space-y-4">
      <WidgetHeader
        title="Budget Burn Forecast"
        subtitle="Projected monthly cloud spend vs. approved budget"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          title="MTD Spend"
          value={`$${(mtdSpend / 1000).toFixed(1)}k`}
          icon={Wallet}
          subtext={`Day ${dayOfMonth} of ${daysInMonth}`}
        />
        <Stat
          title="Remaining"
          value={`$${(budgetRemaining / 1000).toFixed(1)}k`}
          icon={Calendar}
          variant={budgetRemaining < effectiveBudget * 0.2 ? "warning" : "default"}
          subtext={`${daysRemaining} days left`}
        />
        <Stat
          title="Daily Burn"
          value={`$${(actualDailyBurn / 1000).toFixed(1)}k`}
          icon={Flame}
          variant={burnRatio > 1.1 ? "warning" : "default"}
          subtext={`${burnRatio.toFixed(1)}x planned`}
        />
        <Stat
          title="Projected"
          value={`$${(projectedMonthly / 1000).toFixed(1)}k`}
          icon={TrendingUp}
          variant={status === "overspend" ? "danger" : status === "caution" ? "warning" : "default"}
          subtext={`${projectedPct.toFixed(0)}% of budget`}
        />
      </div>

      <div className={cn("rounded-xl border p-4", statusConfig.border, statusConfig.bg)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Forecast status</p>
            <p className={cn("text-2xl font-bold", statusConfig.color)}>{statusConfig.label}</p>
          </div>
          {status !== "on-track" && <AlertTriangle size={24} className={statusConfig.color} />}
        </div>
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>Projected {projectedPct.toFixed(0)}%</span>
            <span>100%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", statusConfig.progress)}
              style={{ width: `${Math.min(100, projectedPct)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Monthly budget: ${(effectiveBudget / 1000).toFixed(1)}k · Planned daily burn: ${(plannedDailyBurn / 1000).toFixed(1)}k
          </p>
        </div>
      </div>
    </Widget>
  );
}
