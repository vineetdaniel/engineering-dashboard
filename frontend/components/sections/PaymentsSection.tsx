"use client";

import {
  CreditCard,
  TrendingUp,
  ShieldAlert,
  RotateCcw,
  Scale,
  AlertCircle,
  Clock,
  Activity,
} from "lucide-react";
import { SectionProps } from "./types";
import { SectionHeader } from "./SectionHeader";
import { Stat } from "@/components/widgets/Stat";
import { TrendChart } from "@/components/TrendChart";
import { DataTable } from "@/components/widgets/DataTable";
import { DataQuality } from "@/components/widgets/DataQuality";
import { FintechMetrics } from "@/components/widgets/FintechMetrics";
import { CustomerImpact } from "@/components/widgets/CustomerImpact";
import { AuthorizationDeclineDrilldown } from "@/components/widgets/AuthorizationDeclineDrilldown";
import { ReconciliationExceptions } from "@/components/widgets/ReconciliationExceptions";
import { FraudOperationsCenter } from "@/components/widgets/FraudOperationsCenter";
import { OnboardingFunnel } from "@/components/widgets/OnboardingFunnel";
import type { DataTableRow } from "@/components/widgets/DataTable";

export function PaymentsSection({ metrics, events, lastUpdated, dataSource }: SectionProps) {
  const txnVolume = metrics.find((m) => m.metric_type === "transaction_volume")?.value;
  const paymentSuccess = metrics.find((m) => m.metric_type === "payment_success_rate")?.value;
  const fraudRate = metrics.find((m) => m.metric_type === "fraud_rate")?.value;
  const chargebackRate = metrics.find((m) => m.metric_type === "chargeback_rate")?.value;
  const settlementFailure = metrics.find((m) => m.metric_type === "settlement_failure_rate")?.value;
  const ledgerImbalance = metrics.find((m) => m.metric_type === "ledger_imbalance")?.value;
  const reconLag = metrics.find((m) => m.metric_type === "reconciliation_lag_minutes")?.value;

  // Build simple trend series from all available daily-ish metric rows
  const txnSeries = metrics
    .filter((m) => m.metric_type === "transaction_volume")
    .slice(0, 8)
    .map((m, i) => ({ label: `D${i + 1}`, value: (m.value ?? 0) / 1_000_000 }));

  const fraudSeries = metrics
    .filter((m) => m.metric_type === "fraud_rate")
    .slice(0, 8)
    .map((m, i) => ({ label: `D${i + 1}`, value: m.value ?? 0 }));

  const chargebackSeries = metrics
    .filter((m) => m.metric_type === "chargeback_rate")
    .slice(0, 8)
    .map((m, i) => ({ label: `D${i + 1}`, value: m.value ?? 0 }));

  const settlementRows: DataTableRow[] = events
    .filter((e) => e.event_type === "vendor_incident" || e.event_type === "incident")
    .slice(0, 6)
    .map((e) => ({
      id: e.id,
      label: e.title,
      meta: e.entity,
      status: e.status,
      severity: e.severity === "critical" ? "critical" : e.severity === "high" ? "high" : "medium",
    }));

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Payments & Business"
        description="Real-time payment health, fraud, and reconciliation"
        lastUpdated={lastUpdated}
      />

      <FintechMetrics metrics={metrics} dataSource={dataSource} />

      <CustomerImpact metrics={metrics} events={events} />

      <AuthorizationDeclineDrilldown metrics={metrics} events={events} />

      <ReconciliationExceptions metrics={metrics} events={events} />

      <FraudOperationsCenter metrics={metrics} events={events} />

      <OnboardingFunnel metrics={metrics} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <Stat
          title="Auth Success"
          value={paymentSuccess != null ? `${paymentSuccess.toFixed(2)}%` : "99.97%"}
          icon={Activity}
          variant={paymentSuccess != null && paymentSuccess < 99.5 ? "danger" : "success"}
          target=">99.9%"
          sparklineData={[99.95, 99.96, 99.94, 99.97, paymentSuccess ?? 99.97]}
        />
      </div>

      <DataQuality metrics={metrics} dataSource={dataSource} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendChart
            title="Transaction Volume"
            subtitle="Millions of transactions / day"
            data={txnSeries.length > 1 ? txnSeries : [{ label: "Today", value: 1.35 }]}
            dataSource={dataSource}
            color="#6366f1"
          />
        </div>
        <TrendChart
          title="Fraud Rate Trend"
          subtitle="% of transactions"
          data={fraudSeries.length > 1 ? fraudSeries : [{ label: "Today", value: 0.12 }]}
          dataSource={dataSource}
          type="area"
          color="#f43f5e"
          target={0.3}
          targetLabel="Target"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TrendChart
          title="Chargeback Rate Trend"
          subtitle="% of transactions"
          data={chargebackSeries.length > 1 ? chargebackSeries : [{ label: "Today", value: 0.04 }]}
          dataSource={dataSource}
          type="area"
          color="#f59e0b"
          target={0.1}
          targetLabel="Target"
        />
        <DataTable
          title="Payment-Impacting Events"
          subtitle="Vendor incidents and service disruptions"
          rows={settlementRows}
          maxRows={6}
          dataSource={dataSource}
        />
      </div>
    </div>
  );
}
