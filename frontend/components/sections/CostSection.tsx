"use client";

import { Activity, TrendingUp, Wallet, PiggyBank } from "lucide-react";
import { SectionProps } from "./types";
import { SectionHeader } from "./SectionHeader";
import { Stat } from "@/components/widgets/Stat";
import { TrendChart } from "@/components/TrendChart";
import { DataTable } from "@/components/widgets/DataTable";
import { ProgressList } from "@/components/widgets/ProgressList";
import { CostPerTransactionDrilldown } from "@/components/widgets/CostPerTransactionDrilldown";
import { CostAnomalyDetection } from "@/components/widgets/CostAnomalyDetection";
import { BudgetBurnForecast } from "@/components/widgets/BudgetBurnForecast";
import { CostSummary } from "@/components/widgets/CostSummary";
import { MonthlySpendHistory } from "@/components/widgets/MonthlySpendHistory";
import { Widget, WidgetHeader } from "@/components/widgets";
import type { DataTableRow, ProgressItem } from "@/components/widgets";

export function CostSection({ metrics, events, lastUpdated, dataSource }: SectionProps) {
  const mtdSpend = metrics.find((m) => m.metric_type === "cloud_spend_mtd")?.value;
  const costPerTxn = metrics.find((m) => m.metric_type === "cost_per_transaction")?.value;
  const budgetUsed = metrics.find((m) => m.metric_type === "budget_used_pct")?.value;
  const savingsOpps = metrics.find((m) => m.metric_type === "savings_opportunities")?.value;
  const monthlyBudget = metrics.find((m) => m.metric_type === "monthly_budget")?.value;

  const dailySpend = metrics
    .filter((m) => m.metric_type === "cloud_spend_mtd")
    .slice(0, 12)
    .map((m, i) => ({ label: `D${i + 1}`, value: (m.value ?? 0) / 30 }));

  const projectedDailyBurn =
    monthlyBudget && monthlyBudget > 0 ? monthlyBudget / 30 : dailySpend[0]?.value ?? 0;

  const burnSeries = dailySpend.map((d) => ({
    ...d,
    forecast: projectedDailyBurn,
  }));

  const awsCostDrivers = metrics.filter((m) => m.metric_type === "cost_driver" && m.source === "aws_cost");
  const seedCostDrivers = events.filter((e) => e.event_type === "cost_driver");
  const costDriverItems = awsCostDrivers.length > 0 ? awsCostDrivers : seedCostDrivers;

  const costDrivers: DataTableRow[] = costDriverItems
    .slice(0, Math.max(5, awsCostDrivers.length))
    .map((item) => ({
      id: item.id,
      label: item.title ?? item.entity ?? "Unknown service",
      meta:
        item.meta?.pct_of_total != null
          ? `${item.meta.pct_of_total}% of spend`
          : item.meta?.current != null
            ? `$${Number(item.meta.current).toLocaleString()}`
            : item.meta?.spend != null
              ? `$${Number(item.meta.spend).toLocaleString()}`
              : item.value != null
                ? `$${Number(item.value).toLocaleString()}`
                : "$0",
      status: item.status ?? "open",
      severity: item.severity === "critical" ? "critical" : item.severity === "high" ? "high" : "medium",
    }));

  const budgets: ProgressItem[] = [
    { id: 1, label: "Cloud spend", value: budgetUsed != null ? Math.round(budgetUsed) : 34, meta: "MTD", color: "#10b981" },
    { id: 2, label: "Data transfer", value: 62, meta: "MTD", color: "#0ea5e9" },
    { id: 3, label: "Reserved capacity", value: 78, meta: "MTD", color: "#6366f1" },
  ];

  const budgetTotal = 12400;
  const spendValue = mtdSpend ?? 4200;
  const budgetPct = budgetUsed ?? Math.round((spendValue / budgetTotal) * 100);

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Cost & Efficiency"
        description="Cloud spend, unit economics, and savings opportunities"
        lastUpdated={lastUpdated}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          title="MTD Cloud Spend"
          value={`$${(spendValue / 1000).toFixed(1)}k`}
          trend="down"
          trendLabel="-8%"
          icon={Activity}
          variant="success"
          target={`$${(budgetTotal / 1000).toFixed(1)}k/mo`}
          sparklineData={[4800, 4700, 4500, 4300, spendValue]}
        />
        <Stat
          title="Cost / Txn"
          value={costPerTxn != null ? `$${costPerTxn.toFixed(3)}` : "$0.003"}
          trend="down"
          trendLabel="-12%"
          icon={TrendingUp}
          variant="success"
          target="<$0.005"
          sparklineData={[0.004, 0.0038, 0.0035, 0.0032, costPerTxn ?? 0.003]}
        />
        <Stat
          title="Budget Used"
          value={`${budgetPct}%`}
          icon={Wallet}
          variant={budgetPct > 80 ? "warning" : "default"}
          subtext="of monthly budget"
        />
        <Stat
          title="Savings Opps"
          value={savingsOpps != null ? `$${savingsOpps}` : "$820"}
          icon={PiggyBank}
          variant="warning"
          subtext="Reserved capacity + rightsizing"
        />
      </div>

      <CostSummary metrics={metrics} events={events} dataSource={dataSource} />

      <MonthlySpendHistory metrics={metrics} dataSource={dataSource} />

      <div className="grid grid-cols-1 gap-5">
        <CostAnomalyDetection metrics={metrics} events={events} />
      </div>

      <div className="grid grid-cols-1 gap-5">
        <BudgetBurnForecast metrics={metrics} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CostPerTransactionDrilldown metrics={metrics} />
        </div>

        <Widget dataSource={dataSource}>
          <WidgetHeader title="Budget Consumption" subtitle="Against monthly budget" dataSource={dataSource} />
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Spent</span>
              <span className="font-medium text-foreground">${spendValue.toLocaleString()}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(100, budgetPct)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>{budgetPct}%</span>
              <span>100%</span>
            </div>
            <p className="pt-1 text-xs text-muted-foreground">
              Projected monthly: ${(spendValue * (budgetTotal / spendValue)).toLocaleString()}
            </p>
          </div>
        </Widget>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <TrendChart
          title="Daily Cloud Burn vs. Forecast"
          subtitle="USD / day with monthly budget run-rate"
          data={burnSeries}
          dataSource={dataSource}
          type="composed"
          series={[
            { key: "value", label: "Actual", color: "#10b981", type: "bar" },
            { key: "forecast", label: "Forecast", color: "#94a3b8", type: "area" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ProgressList
          title="Budget vs Allocation"
          subtitle="Spend by budget category"
          items={budgets}
        />
        <DataTable
          title="Top Cost Drivers"
          subtitle="Services by estimated spend"
          rows={costDrivers}
          dataSource={dataSource}
          emptyText="No cost driver data available"
        />
      </div>
    </div>
  );
}
