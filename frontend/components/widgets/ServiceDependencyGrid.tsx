"use client";

import { ArrowRight, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ServiceDependencyGridProps {
  metrics: any[];
  events: any[];
  className?: string;
}

const FLOW = [
  { id: "api-gateway", label: "API Gateway", dependsOn: [] },
  { id: "auth-service", label: "Auth", dependsOn: ["api-gateway"] },
  { id: "payments-core", label: "Payments Core", dependsOn: ["auth-service"] },
  { id: "ledger", label: "Ledger", dependsOn: ["payments-core"] },
  { id: "webhook-router", label: "Webhooks", dependsOn: ["ledger"] },
];

export function ServiceDependencyGrid({ metrics, events, className }: ServiceDependencyGridProps) {
  const healthByService = FLOW.reduce((acc: Record<string, { uptime: number; latency: number; errors: number; incidents: number }>, svc) => {
    const uptime = metrics
      .filter((m) => m.metric_type === "uptime_pct" && (m.meta?.service === svc.id || m.entity === svc.id))
      .map((m) => m.value)
      .pop() ?? 99.9;
    const latency = metrics
      .filter((m) => m.metric_type === "p95_latency_ms" && (m.meta?.service === svc.id || m.entity === svc.id))
      .map((m) => m.value)
      .pop() ?? 120;
    const errors = metrics
      .filter((m) => m.metric_type === "error_rate_pct" && (m.meta?.service === svc.id || m.entity === svc.id))
      .map((m) => m.value)
      .pop() ?? 0.1;
    const incidents = events.filter(
      (e) =>
        e.event_type === "incident" &&
        e.status !== "resolved" &&
        (e.meta?.service === svc.id || e.entity === svc.id)
    ).length;
    acc[svc.id] = { uptime, latency, errors, incidents };
    return acc;
  }, {});

  function statusFor(serviceId: string) {
    const h = healthByService[serviceId];
    if (h.incidents > 0 || h.uptime < 99.5 || h.errors > 1) return "critical";
    if (h.uptime < 99.9 || h.latency > 200 || h.errors > 0.2) return "degraded";
    return "healthy";
  }

  const statusConfig = {
    healthy: { icon: CheckCircle2, label: "Healthy", class: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" },
    degraded: { icon: AlertTriangle, label: "Degraded", class: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300" },
    critical: { icon: XCircle, label: "Critical", class: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300" },
  };

  return (
    <Widget className={className}>
      <WidgetHeader
        title="Payment Flow Dependency Map"
        subtitle="Service health along the critical payment path"
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {FLOW.map((svc, index) => {
          const status = statusFor(svc.id);
          const config = statusConfig[status];
          const Icon = config.icon;
          const h = healthByService[svc.id];
          return (
            <div key={svc.id} className="flex items-center gap-3">
              <div className="flex-1 rounded-xl border border-border bg-card p-3 transition hover:bg-muted/40">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{svc.label}</p>
                  <Badge variant="outline" className={cn("gap-1 text-[10px]", config.class)}>
                    <Icon size={10} />
                    {config.label}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px] text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground">{h.uptime.toFixed(2)}%</p>
                    <p>Uptime</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{Math.round(h.latency)}ms</p>
                    <p>P95</p>
                  </div>
                  <div>
                    <p className={cn("font-medium", h.incidents > 0 ? "text-rose-600" : "text-foreground")}>{h.incidents}</p>
                    <p>Open</p>
                  </div>
                </div>
              </div>
              {index < FLOW.length - 1 && (
                <div className="hidden text-muted-foreground lg:block">
                  <ArrowRight size={16} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Widget>
  );
}
