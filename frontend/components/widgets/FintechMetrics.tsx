"use client";

import { CreditCard, TrendingUp, ShieldAlert, RotateCcw } from "lucide-react";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";
import { Stat } from "@/components/widgets/Stat";
import { cn } from "@/lib/utils";

interface FintechMetricsProps {
  metrics: any[];
  className?: string;
  dataSource?: "live" | "seed" | "mixed" | "dummy";
}

export function FintechMetrics({ metrics, className, dataSource }: FintechMetricsProps) {
  const paymentSuccess = metrics.find((m) => m.metric_type === "payment_success_rate")?.value;
  const txnVolume = metrics.find((m) => m.metric_type === "transaction_volume")?.value;
  const fraudRate = metrics.find((m) => m.metric_type === "fraud_rate")?.value;
  const chargebackRate = metrics.find((m) => m.metric_type === "chargeback_rate")?.value;

  const volumeM = txnVolume != null ? (txnVolume / 1_000_000).toFixed(2) : "—";

  return (
    <Widget className={className} dataSource={dataSource}>
      <WidgetHeader
        title="Fintech Business Health"
        subtitle="Payment success, fraud, and chargeback rates"
        dataSource={dataSource}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          title="Payment Success"
          value={paymentSuccess != null ? `${paymentSuccess.toFixed(2)}%` : "99.97%"}
          icon={CreditCard}
          variant={paymentSuccess != null && paymentSuccess < 99.5 ? "danger" : "success"}
          target=">99.9%"
          sparklineData={[99.95, 99.96, 99.94, 99.97, paymentSuccess ?? 99.97]}
        />
        <Stat
          title="Txn Volume"
          value={`${volumeM}M`}
          trend="up"
          trendLabel="+4.2%"
          icon={TrendingUp}
          subtext="Last 24h"
          sparklineData={[1.2, 1.3, 1.25, 1.4, Number(volumeM) || 1.35]}
        />
        <Stat
          title="Fraud Rate"
          value={fraudRate != null ? `${fraudRate.toFixed(2)}%` : "0.12%"}
          trend="down"
          trendLabel="-0.03%"
          icon={ShieldAlert}
          variant={fraudRate != null && fraudRate > 0.5 ? "warning" : "success"}
          trendInverse
          target="<0.3%"
          sparklineData={[0.18, 0.16, 0.15, 0.13, fraudRate ?? 0.12]}
        />
        <Stat
          title="Chargeback Rate"
          value={chargebackRate != null ? `${chargebackRate.toFixed(2)}%` : "0.04%"}
          trend="down"
          trendLabel="-0.01%"
          icon={RotateCcw}
          variant={chargebackRate != null && chargebackRate > 0.2 ? "warning" : "success"}
          trendInverse
          target="<0.1%"
          sparklineData={[0.07, 0.06, 0.05, 0.045, chargebackRate ?? 0.04]}
        />
      </div>
    </Widget>
  );
}
