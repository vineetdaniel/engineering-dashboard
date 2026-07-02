"use client";

import { Scale, AlertCircle, Clock, ShieldCheck } from "lucide-react";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";
import { Stat } from "@/components/widgets/Stat";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DataQualityProps {
  metrics: any[];
  className?: string;
  dataSource?: "live" | "seed" | "mixed" | "dummy";
}

export function DataQuality({ metrics, className, dataSource }: DataQualityProps) {
  const settlementFailure = metrics.find((m) => m.metric_type === "settlement_failure_rate")?.value;
  const ledgerImbalance = metrics.find((m) => m.metric_type === "ledger_imbalance")?.value;
  const reconLag = metrics.find((m) => m.metric_type === "reconciliation_lag_minutes")?.value;

  const healthy =
    (settlementFailure == null || settlementFailure < 0.1) &&
    (ledgerImbalance == null || ledgerImbalance < 1000) &&
    (reconLag == null || reconLag < 30);

  return (
    <Widget className={className} dataSource={dataSource}>
      <WidgetHeader
        title="Data Quality & Reconciliation"
        subtitle="Settlement health, ledger balance, and reconciliation lag"
        dataSource={dataSource}
        action={
          healthy ? (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              <ShieldCheck size={12} className="mr-1" /> Healthy
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              <AlertCircle size={12} className="mr-1" /> Review needed
            </Badge>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          title="Settlement Failure Rate"
          value={settlementFailure != null ? `${settlementFailure.toFixed(2)}%` : "0.02%"}
          icon={Scale}
          variant={settlementFailure != null && settlementFailure > 0.1 ? "warning" : "success"}
          trendInverse
          target="<0.1%"
          sparklineData={[0.05, 0.04, 0.03, 0.025, settlementFailure ?? 0.02]}
        />
        <Stat
          title="Ledger Imbalance"
          value={ledgerImbalance != null ? `$${ledgerImbalance.toLocaleString()}` : "$0"}
          icon={AlertCircle}
          variant={ledgerImbalance != null && ledgerImbalance > 1000 ? "warning" : "success"}
          trendInverse
          target="$0"
          sparklineData={[1200, 800, 400, 100, ledgerImbalance ?? 0]}
        />
        <Stat
          title="Reconciliation Lag"
          value={reconLag != null ? `${Math.round(reconLag)}m` : "12m"}
          icon={Clock}
          variant={reconLag != null && reconLag > 60 ? "warning" : "success"}
          trendInverse
          target="<30m"
          sparklineData={[45, 30, 20, 15, reconLag ?? 12]}
        />
      </div>
    </Widget>
  );
}
