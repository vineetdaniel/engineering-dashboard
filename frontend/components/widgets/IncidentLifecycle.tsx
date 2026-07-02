"use client";

import { useMemo } from "react";
import { Clock, Radio, CheckCircle2, AlertTriangle, Activity, ChevronRight } from "lucide-react";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";

interface IncidentLifecycleProps {
  events: any[];
  maxIncidents?: number;
}

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const severityConfig: Record<string, { label: string; class: string; icon: typeof AlertTriangle }> = {
  critical: { label: "P0", class: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300", icon: AlertTriangle },
  high: { label: "P1", class: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300", icon: AlertTriangle },
  medium: { label: "P2", class: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300", icon: Activity },
  low: { label: "P3", class: "border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300", icon: Activity },
};

export function IncidentLifecycle({ events, maxIncidents = 6 }: IncidentLifecycleProps) {
  const incidents = useMemo(() => {
    return events
      .filter((e) => e.event_type === "incident")
      .sort((a, b) => new Date(b.happened_at).getTime() - new Date(a.happened_at).getTime())
      .slice(0, maxIncidents)
      .map((e) => {
        const started = parseDate(e.happened_at);
        const detected = parseDate(e.meta?.detected_at);
        const acknowledged = parseDate(e.meta?.acknowledged_at);
        const resolved = parseDate(e.meta?.resolved_at);
        const isResolved = e.status === "resolved";
        return { ...e, started, detected, acknowledged, resolved, isResolved };
      });
  }, [events, maxIncidents]);

  return (
    <Widget className="space-y-4">
      <WidgetHeader
        title="Incident Lifecycle"
        subtitle="Detected → Acknowledged → Resolved"
      />

      <div className="space-y-4">
        {incidents.map((incident) => {
          const config = severityConfig[incident.severity] || severityConfig.low;
          const Icon = config.icon;
          const steps = [
            { key: "detected", label: "Detected", time: incident.detected || incident.started, icon: Clock, done: !!incident.detected },
            { key: "acknowledged", label: "Acknowledged", time: incident.acknowledged, icon: Radio, done: !!incident.acknowledged },
            { key: "resolved", label: "Resolved", time: incident.resolved, icon: CheckCircle2, done: incident.isResolved },
          ];

          return (
            <div key={incident.id} className="rounded-xl border border-border bg-muted/40 p-4">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-start gap-2">
                  <Icon size={16} className={cn("mt-0.5 shrink-0", incident.severity === "critical" ? "text-rose-500" : incident.severity === "high" ? "text-amber-500" : "text-blue-500")} />
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={config.class}>{config.label}</Badge>
                      <span className="text-sm font-semibold text-foreground">{incident.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {incident.entity} · {incident.status}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {incident.started ? formatDistanceToNow(incident.started, { addSuffix: true }) : "—"}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {steps.map((step, i) => {
                  const StepIcon = step.icon;
                  const isLast = i === steps.length - 1;
                  return (
                    <div key={step.key} className="flex flex-1 items-center">
                      <div className="flex flex-col items-center">
                        <div
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold transition",
                            step.done
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                              : "border-border bg-muted text-muted-foreground"
                          )}
                        >
                          <StepIcon size={12} />
                        </div>
                        <span className="mt-1 text-[10px] text-muted-foreground">{step.label}</span>
                        <span className="text-[10px] font-medium text-foreground">
                          {step.time ? format(step.time, "HH:mm") : "—"}
                        </span>
                      </div>
                      {!isLast && (
                        <ChevronRight size={14} className={cn("mx-1 shrink-0", step.done ? "text-emerald-500" : "text-muted-foreground/50")} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {incidents.length === 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            No incidents in the selected window.
          </div>
        )}
      </div>
    </Widget>
  );
}
