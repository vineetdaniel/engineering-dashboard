"use client";

import { TrendingUp, AlertTriangle, DollarSign, Activity, CreditCard } from "lucide-react";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PredictionsProps {
  metrics: any[];
  events: any[];
  className?: string;
  dataSource?: "live" | "seed" | "mixed" | "dummy";
}

export function Predictions({ metrics, events, className, dataSource }: PredictionsProps) {
  const mtdSpend = metrics.find((m) => m.metric_type === "mtd_spend")?.value ?? 0;
  const budget = metrics.find((m) => m.metric_type === "monthly_budget")?.value ?? 0;
  const daysIntoMonth = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  const costRisk = budget > 0 ? (mtdSpend / budget) / (daysIntoMonth / daysInMonth) : 1;
  const costOverrun = Math.max(0, Math.round((costRisk - 1) * 100));

  const incidents7d = events.filter((e) => e.event_type === "incident").length;
  const cves = events.filter((e) => e.event_type === "dependabot_alert");
  const criticalCve = cves.some((e) => e.severity === "critical");

  const incidentRisk = incidents7d >= 2 || criticalCve ? "high" : incidents7d === 1 || cves.length > 3 ? "medium" : "low";

  const paymentSuccess = metrics.find((m) => m.metric_type === "payment_success_rate")?.value ?? 99.9;
  const fraudRate = metrics.find((m) => m.metric_type === "fraud_rate")?.value ?? 0.1;
  const settlementFailure = metrics.find((m) => m.metric_type === "settlement_failure_rate")?.value ?? 0;

  const fintechRisk =
    paymentSuccess < 99 || fraudRate > 0.5 || settlementFailure > 0.2
      ? "high"
      : paymentSuccess < 99.5 || fraudRate > 0.3 || settlementFailure > 0.1
      ? "medium"
      : "low";

  const cards = [
    {
      id: "cost",
      icon: DollarSign,
      title: "Cost Overrun Forecast",
      value: costOverrun > 0 ? `+${costOverrun}%` : "On track",
      detail: budget > 0 ? `MTD spend $${mtdSpend.toLocaleString()} / $${budget.toLocaleString()} budget` : "No budget metric",
      risk: costOverrun > 15 ? "high" : costOverrun > 0 ? "medium" : "low",
    },
    {
      id: "incident",
      icon: Activity,
      title: "Incident Risk",
      value: incidentRisk === "high" ? "Elevated" : incidentRisk === "medium" ? "Moderate" : "Low",
      detail: `${incidents7d} incidents this week · ${cves.length} open CVEs`,
      risk: incidentRisk,
    },
    {
      id: "fintech",
      icon: CreditCard,
      title: "Fintech Risk",
      value: fintechRisk === "high" ? "Elevated" : fintechRisk === "medium" ? "Moderate" : "Low",
      detail: `Payment success ${paymentSuccess.toFixed(2)}% · Fraud ${fraudRate.toFixed(2)}% · Settlement ${settlementFailure.toFixed(2)}%`,
      risk: fintechRisk,
    },
  ];

  return (
    <Widget className={className} dataSource={dataSource}>
      <WidgetHeader
        title="Predictive Signals"
        subtitle="Forward-looking risk based on current run rate"
        dataSource={dataSource}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className={cn(
                "rounded-xl border p-4 transition hover:bg-muted/40",
                card.risk === "high"
                  ? "border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/30"
                  : card.risk === "medium"
                  ? "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30"
                  : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30"
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon
                  size={16}
                  className={cn(
                    card.risk === "high"
                      ? "text-rose-600"
                      : card.risk === "medium"
                      ? "text-amber-600"
                      : "text-emerald-600"
                  )}
                />
                <span className="text-xs font-medium text-muted-foreground">{card.title}</span>
              </div>
              <p className="text-lg font-semibold">{card.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
              <Badge
                variant="outline"
                className={cn(
                  "mt-3",
                  card.risk === "high"
                    ? "border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300"
                    : card.risk === "medium"
                    ? "border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-300"
                    : "border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300"
                )}
              >
                {card.risk === "high" && <AlertTriangle size={12} className="mr-1" />}
                {card.risk} risk
              </Badge>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}
