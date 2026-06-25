"use client";

import { Cloud, DollarSign, PiggyBank, TrendingUp, AlertTriangle } from "lucide-react";
import { SectionProps } from "../sections/types";
import { Stat } from "./Stat";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { DataTable, type DataTableRow } from "./DataTable";
import { cn } from "@/lib/utils";

export function CostSummary({
  metrics,
  events,
  dataSource,
}: {
  metrics: SectionProps["metrics"];
  events: SectionProps["events"];
  dataSource?: SectionProps["dataSource"];
}) {
  const mtd = metrics.find((m) => m.metric_type === "cloud_spend_mtd")?.value ?? 0;
  const budget = metrics.find((m) => m.metric_type === "monthly_budget")?.value ?? 0;
  const budgetUsed = metrics.find((m) => m.metric_type === "budget_used_pct")?.value ?? 0;
  const savings = metrics.find((m) => m.metric_type === "savings_opportunities")?.value ?? 0;

  const awsDriverMetrics = metrics.filter((m) => m.metric_type === "cost_driver" && m.source === "aws_cost");
  const driverMetrics = metrics.filter((m) => m.metric_type === "cost_driver");
  const driverEvents = events.filter((e) => e.event_type === "cost_driver");

  function formatDriverMeta(item: any): string {
    if (item.meta?.pct_of_total != null) return `${item.meta.pct_of_total}% of spend`;
    if (item.meta?.current != null) return `$${Number(item.meta.current).toLocaleString()}`;
    if (item.meta?.spend != null) return `$${Number(item.meta.spend).toLocaleString()}`;
    if (item.value != null) return `$${Number(item.value).toLocaleString()}`;
    return "$0";
  }

  const driverItems = awsDriverMetrics.length > 0 ? awsDriverMetrics : [...driverEvents, ...driverMetrics];

  const rows: DataTableRow[] = driverItems
    .slice(0, Math.max(5, awsDriverMetrics.length))
    .map((item, i) => ({
      id: item.id ?? `cost-${i}`,
      label: item.title ?? item.entity ?? "Unknown service",
      meta: formatDriverMeta(item),
      status: item.status ?? "open",
      severity: item.severity === "high" ? "high" : item.severity === "critical" ? "critical" : "medium",
    }));

  const currency = metrics.find((m) => m.metric_type === "cloud_spend_mtd")?.meta?.currency ?? "USD";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          title="MTD Cloud Spend"
          value={formatCurrency(mtd)}
          icon={Cloud}
          variant={budgetUsed > 80 ? "warning" : "default"}
          subtext={`Currency: ${currency}`}
          target={budget > 0 ? formatCurrency(budget) : undefined}
          trend="flat"
          trendLabel="MTD"
        />
        <Stat
          title="Monthly Budget"
          value={formatCurrency(budget)}
          icon={DollarSign}
          variant="default"
          subtext={budget > 0 ? `${budgetUsed.toFixed(1)}% used` : "Auto-estimated from last month"}
        />
        <Stat
          title="Budget Used"
          value={`${Number(budgetUsed).toFixed(1)}%`}
          icon={TrendingUp}
          variant={budgetUsed > 90 ? "danger" : budgetUsed > 75 ? "warning" : "success"}
          subtext="of monthly budget"
          target="<80%"
          trendInverse
        />
        <Stat
          title="Savings Opportunities"
          value={formatCurrency(savings)}
          icon={PiggyBank}
          variant={savings > 0 ? "warning" : "default"}
          subtext="Potential monthly savings"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DataTable
            title="Top Cost Drivers"
            subtitle="Services by spend"
            rows={rows}
            dataSource={dataSource}
            emptyText="No cost driver data available. Sync the AWS Cost connector."
            maxRows={6}
          />
        </div>

        <Widget dataSource={dataSource}>
          <WidgetHeader title="Budget Consumption" subtitle="MTD vs monthly budget" dataSource={dataSource} />
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Spent</span>
              <span className="font-medium text-foreground">{formatCurrency(mtd)}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  budgetUsed > 90 ? "bg-rose-500" : budgetUsed > 75 ? "bg-amber-500" : "bg-emerald-500"
                )}
                style={{ width: `${Math.min(100, budgetUsed)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>{Number(budgetUsed).toFixed(0)}%</span>
              <span>100%</span>
            </div>

            {budgetUsed > 80 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  Budget is {budgetUsed.toFixed(1)}% used. Review the cost drivers table to identify
                  the biggest contributor.
                </span>
              </div>
            )}

            <div className="pt-2 text-xs text-muted-foreground">
              Monthly budget: {formatCurrency(budget)}
            </div>
          </div>
        </Widget>
      </div>
    </div>
  );
}

function formatCurrency(value: number | string | undefined): string {
  if (value == null) return "$0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "$0";
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}k`;
  return `$${num.toFixed(0)}`;
}
