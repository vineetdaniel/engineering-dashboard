"use client";

import { useMemo } from "react";
import { CalendarDays, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { SectionProps } from "../sections/types";
import { Stat } from "./Stat";
import { TrendChart } from "@/components/TrendChart";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";
import { cn } from "@/lib/utils";

interface MonthlySpendHistoryProps {
  metrics: SectionProps["metrics"];
  dataSource?: SectionProps["dataSource"];
  className?: string;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonthLabel(period: string): string {
  if (!period || period.length < 7) return period;
  const [year, month] = period.split("-");
  const idx = parseInt(month, 10) - 1;
  return `${MONTH_NAMES[idx] ?? month} ${year}`;
}

function formatCurrency(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return "$0";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

export function MonthlySpendHistory({ metrics, dataSource, className }: MonthlySpendHistoryProps) {
  const history = useMemo(() => {
    const rows = metrics
      .filter((m) => m.metric_type === "monthly_spend" && m.source === "aws_cost")
      .map((m) => ({
        period: String(m.meta?.period || ""),
        spend: Number(m.value ?? 0),
        timestamp: m.timestamp,
      }))
      .filter((r) => r.period && r.spend >= 0)
      .sort((a, b) => a.period.localeCompare(b.period));
    return rows.slice(-12);
  }, [metrics]);

  const budget = useMemo(() => {
    const b = metrics.find((m) => m.metric_type === "monthly_budget" && m.source === "aws_cost")?.value;
    return b != null && b > 0 ? Number(b) : 0;
  }, [metrics]);

  const chartData = useMemo(() => {
    return history.map((row) => ({
      label: formatMonthLabel(row.period),
      period: row.period,
      spend: row.spend,
      budget: budget > 0 ? budget : 0,
    }));
  }, [history, budget]);

  const stats = useMemo(() => {
    if (history.length === 0) return null;
    const current = history[history.length - 1]?.spend ?? 0;
    const previous = history[history.length - 2]?.spend ?? 0;
    const changePct = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    const trailing = history.slice(-3);
    const avg = trailing.reduce((sum, r) => sum + r.spend, 0) / trailing.length;
    const max = Math.max(...history.map((r) => r.spend));
    return { current, previous, changePct, avg, max };
  }, [history]);

  if (history.length === 0) {
    return (
      <Widget className={cn("flex flex-col", className)} dataSource={dataSource}>
        <WidgetHeader
          title="Monthly AWS Spend History"
          subtitle="Trailing 12 months from Cost Explorer"
          dataSource={dataSource}
        />
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No historical monthly spend data. Sync the AWS Cost connector to populate this chart.
          </p>
        </div>
      </Widget>
    );
  }

  return (
    <div className={cn("space-y-5", className)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          title="Current Month"
          value={formatCurrency(stats?.current)}
          icon={Wallet}
          variant="default"
          subtext={history[history.length - 1]?.period}
        />
        <Stat
          title="vs. Last Month"
          value={`${Math.abs(stats?.changePct ?? 0).toFixed(1)}%`}
          icon={(stats?.changePct ?? 0) >= 0 ? TrendingUp : TrendingDown}
          variant={(stats?.changePct ?? 0) > 10 ? "warning" : (stats?.changePct ?? 0) < -10 ? "success" : "default"}
          trend={(stats?.changePct ?? 0) >= 0 ? "up" : "down"}
          trendLabel={(stats?.changePct ?? 0) >= 0 ? "Increase" : "Decrease"}
        />
        <Stat
          title="3-Month Avg"
          value={formatCurrency(stats?.avg)}
          icon={CalendarDays}
          variant="default"
          subtext="Trailing average"
        />
        <Stat
          title="Highest Month"
          value={formatCurrency(stats?.max)}
          icon={Wallet}
          variant="warning"
          subtext="In selected window"
        />
      </div>

      <TrendChart
        title="Monthly AWS Spend History"
        subtitle="Trailing 12 months from Cost Explorer"
        data={chartData}
        dataSource={dataSource}
        type="composed"
        series={[
          { key: "spend", label: "Actual spend", color: "#10b981", type: "bar" },
          ...(budget > 0 ? [{ key: "budget", label: "Monthly budget", color: "#94a3b8", type: "area" as const }] : []),
        ]}
        className="h-80"
      />
    </div>
  );
}
