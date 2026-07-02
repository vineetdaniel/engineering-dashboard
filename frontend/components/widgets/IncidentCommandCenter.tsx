"use client";

import { AlertTriangle, Clock, Users, Activity, CheckCircle2 } from "lucide-react";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Incident {
  id: number;
  title: string;
  severity: string;
  status: string;
  entity?: string;
  happened_at?: string;
  owner?: string;
}

interface IncidentCommandCenterProps {
  incidents: Incident[];
  className?: string;
  dataSource?: "live" | "seed" | "mixed" | "dummy";
}

const severityConfig: Record<string, { label: string; class: string; icon: typeof AlertTriangle }> = {
  critical: { label: "P0", class: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300", icon: AlertTriangle },
  high: { label: "P1", class: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300", icon: AlertTriangle },
  medium: { label: "P2", class: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300", icon: Activity },
  low: { label: "P3", class: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300", icon: Activity },
};

function elapsedHours(dateStr?: string) {
  if (!dateStr) return "—";
  const hours = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60)));
  if (hours === 0) return "<1h";
  return `${hours}h`;
}

export function IncidentCommandCenter({ incidents, className, dataSource }: IncidentCommandCenterProps) {
  const active = incidents.filter((i) => i.status !== "resolved");
  const critical = active.filter((i) => i.severity === "critical");
  const high = active.filter((i) => i.severity === "high");

  if (active.length === 0) {
    return (
      <Widget className={className} dataSource={dataSource}>
        <WidgetHeader title="Incident Command Center" subtitle="Active incidents and war room status" dataSource={dataSource} />
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CheckCircle2 className="text-emerald-600" size={20} />
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">All clear</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">No active incidents. Last resolved incident tracked below.</p>
          </div>
        </div>
      </Widget>
    );
  }

  return (
    <Widget className={cn("border-l-4", critical.length > 0 ? "border-l-rose-500" : high.length > 0 ? "border-l-amber-500" : "border-l-blue-500", className)} dataSource={dataSource}>
      <WidgetHeader
        title="Incident Command Center"
        subtitle={`${active.length} active incident${active.length === 1 ? "" : "s"} · ${critical.length} P0 · ${high.length} P1`}
        dataSource={dataSource}
        action={
          critical.length > 0 && (
            <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 animate-pulse">
              WAR ROOM ACTIVE
            </Badge>
          )
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {active.slice(0, 6).map((incident) => {
          const config = severityConfig[incident.severity] || severityConfig.low;
          const Icon = config.icon;
          return (
            <div
              key={incident.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Icon size={16} className={cn("shrink-0", incident.severity === "critical" ? "text-rose-500" : incident.severity === "high" ? "text-amber-500" : "text-blue-500")} />
                  <Badge variant="outline" className={config.class}>{config.label}</Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock size={12} />
                  {elapsedHours(incident.happened_at)}
                </div>
              </div>

              <p className="mt-2 text-sm font-medium line-clamp-2">{incident.title}</p>
              <p className="text-xs text-muted-foreground">{incident.entity}</p>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users size={12} />
                  {incident.owner || "Unassigned"}
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  View
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}
