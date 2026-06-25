"use client";

import { Activity, ShieldAlert, Zap, Wallet, GitBranch } from "lucide-react";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ExecutiveSummaryProps {
  data: {
    openPRs: number;
    openIssues: number;
    openBugs: number;
    criticalCount: number;
    activeIncidents: any[];
    p0p1Incidents: any[];
  };
  metrics: any[];
  events: any[];
  className?: string;
  dataSource?: "live" | "seed" | "mixed" | "dummy";
}

export function ExecutiveSummary({ data, metrics, events, className, dataSource }: ExecutiveSummaryProps) {
  const uptime = metrics.find((m) => m.metric_type === "uptime_pct")?.value ?? 99.9;
  const paymentSuccess = metrics.find((m) => m.metric_type === "payment_success_rate")?.value ?? 99.9;
  const fraudRate = metrics.find((m) => m.metric_type === "fraud_rate")?.value ?? 0.1;
  const mtdSpend = metrics.find((m) => m.metric_type === "cloud_spend_mtd")?.value ?? 0;
  const monthlyBudget = metrics.find((m) => m.metric_type === "monthly_budget")?.value ?? 1;
  const deployFreq = metrics.find((m) => m.metric_type === "deploy_frequency")?.value ?? 3;
  const changeFailure = metrics.find((m) => m.metric_type === "change_failure_rate")?.value ?? 5;
  const mttr = metrics.find((m) => m.metric_type === "mttr_minutes")?.value ?? 30;

  const budgetPct = (mtdSpend / monthlyBudget) * 100;

  // Compute sub-scores (0-100)
  const uptimeScore = Math.min(100, Math.max(0, (uptime - 99) / 0.9 * 100));
  const paymentScore = Math.min(100, Math.max(0, (paymentSuccess - 98) / 1.9 * 100));
  const securityScore = Math.max(0, 100 - data.criticalCount * 15 - data.p0p1Incidents.length * 12);
  const costScore = Math.min(100, Math.max(0, 100 - budgetPct));
  const flowScore = Math.min(100, Math.max(0, 100 - (changeFailure - 2) * 5 - (mttr - 15) * 1));

  const overall = Math.round((uptimeScore + paymentScore + securityScore + costScore + flowScore) / 5);
  const grade = overall >= 90 ? "A" : overall >= 75 ? "B" : overall >= 60 ? "C" : "D";

  const factors = [
    { id: "uptime", label: "Uptime", score: Math.round(uptimeScore), value: `${uptime.toFixed(2)}%`, icon: Activity },
    { id: "payments", label: "Payments", score: Math.round(paymentScore), value: `${paymentSuccess.toFixed(2)}%`, icon: Wallet },
    { id: "security", label: "Security", score: Math.max(0, Math.min(100, securityScore)), value: `${data.criticalCount} critical`, icon: ShieldAlert },
    { id: "cost", label: "Cost", score: Math.round(costScore), value: `${budgetPct.toFixed(1)}% budget`, icon: Wallet },
    { id: "flow", label: "Engineering Flow", score: Math.max(0, Math.min(100, flowScore)), value: `${deployFreq}/day`, icon: GitBranch },
  ];

  return (
    <Widget className={className} dataSource={dataSource}>
      <WidgetHeader
        title="Executive Summary"
        subtitle="Overall CTO health score and critical rollup"
        dataSource={dataSource}
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="flex items-center gap-5">
          <div className={cn(
            "flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl text-4xl font-bold shadow",
            overall >= 75 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
            overall >= 60 ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
            "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
          )}>
            {grade}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">Overall health score</p>
            <p className={cn(
              "text-4xl font-bold tracking-tight text-foreground",
              overall >= 75 ? "text-emerald-700 dark:text-emerald-300" : overall >= 60 ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300"
            )}>
              {overall}
            </p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {data.p0p1Incidents.length} P0/P1 incidents · {data.criticalCount} critical CVEs · ${(mtdSpend / 1000).toFixed(1)}k MTD spend
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {factors.map((factor) => {
            const Icon = factor.icon;
            return (
              <div key={factor.id} className="rounded-xl border border-border bg-muted/70 p-3 shadow-sm dark:bg-card">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-secondary-foreground">
                  <Icon size={12} className="text-foreground" />
                  {factor.label}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">{factor.value}</span>
                  <Badge variant="outline" className={cn(
                    "text-[10px] font-semibold",
                    factor.score >= 80 ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" :
                    factor.score >= 60 ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300" :
                    "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                  )}>
                    {factor.score}%
                  </Badge>
                </div>
                <Progress value={factor.score} className="mt-2 h-1.5" />
              </div>
            );
          })}
        </div>
      </div>
    </Widget>
  );
}
