"use client";

import { AlertTriangle, CreditCard, TrendingDown, Activity } from "lucide-react";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CustomerImpactProps {
  metrics: any[];
  events: any[];
  className?: string;
}

export function CustomerImpact({ metrics, events, className }: CustomerImpactProps) {
  const paymentSuccess = metrics.find((m) => m.metric_type === "payment_success_rate")?.value ?? 99.9;
  const txnVolume = metrics.find((m) => m.metric_type === "transaction_volume")?.value ?? 0;
  const activeIncidents = events.filter((e) => e.event_type === "incident" && e.status !== "resolved");
  const activeVendorIncidents = events.filter(
    (e) => e.event_type === "vendor_incident" && e.status !== "resolved"
  );

  const impacted = activeIncidents.length > 0 || activeVendorIncidents.length > 0 || paymentSuccess < 99.5;
  const volumeDrop = impacted && paymentSuccess < 99.5 ? Math.round((99.9 - paymentSuccess) * 100) / 10 : 0;

  const incidents = [...activeIncidents, ...activeVendorIncidents].slice(0, 4);

  return (
    <Widget className={className}>
      <WidgetHeader
        title="Customer Impact"
        subtitle="Payment health correlation with active incidents"
        action={
          impacted ? (
            <Badge
              variant="outline"
              className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
            >
              <AlertTriangle size={12} className="mr-1" /> Impact detected
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
            >
              <Activity size={12} className="mr-1" /> Normal
            </Badge>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CreditCard size={14} />
            <span className="text-xs font-medium">Payment success</span>
          </div>
          <p
            className={cn(
              "mt-2 text-2xl font-bold",
              paymentSuccess < 99.5 ? "text-rose-600" : paymentSuccess < 99.9 ? "text-amber-600" : "text-emerald-600"
            )}
          >
            {paymentSuccess.toFixed(2)}%
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {paymentSuccess < 99.5 ? "Below SLA threshold" : "Within SLA"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingDown size={14} />
            <span className="text-xs font-medium">Estimated volume drop</span>
          </div>
          <p className={cn("mt-2 text-2xl font-bold", volumeDrop > 0 ? "text-rose-600" : "text-emerald-600")}>
            {volumeDrop > 0 ? `-${volumeDrop.toFixed(1)}%` : "0%"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            vs. baseline {((txnVolume / 1_000_000) * (1 + volumeDrop / 100)).toFixed(2)}M
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertTriangle size={14} />
            <span className="text-xs font-medium">Active disruptors</span>
          </div>
          <p className={cn("mt-2 text-2xl font-bold", incidents.length > 0 ? "text-rose-600" : "text-emerald-600")}>
            {incidents.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeIncidents.length} incidents · {activeVendorIncidents.length} vendor
          </p>
        </div>
      </div>

      {incidents.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Likely contributing events</p>
          {incidents.map((incident) => (
            <div
              key={incident.id}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                incident.severity === "critical"
                  ? "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950"
                  : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950"
              )}
            >
              <span className="truncate font-medium">{incident.title}</span>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {incident.severity}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}
