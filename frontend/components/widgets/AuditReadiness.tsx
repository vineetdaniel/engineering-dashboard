"use client";

import { useMemo } from "react";
import { ShieldCheck, AlertTriangle, CalendarDays, FileCheck, Clock } from "lucide-react";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface AuditReadinessProps {
  metrics: any[];
  events: any[];
  dataSource?: "live" | "seed" | "mixed" | "dummy";
}

export function AuditReadiness({ metrics, events, dataSource }: AuditReadinessProps) {
  const frameworks = useMemo(() => {
    return ["soc2", "pci", "iso27001", "gdpr", "sox"].map((fw) => {
      const scoreMetric = metrics
        .filter((m) => m.metric_type === "compliance_framework_score" && (m.meta?.framework === fw || m.entity === fw))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      const evidence = metrics.filter(
        (m) => m.metric_type === "compliance_evidence" && (m.meta?.framework === fw || m.entity === fw)
      );
      const submitted = evidence.filter((m) => m.meta?.status === "submitted").length;
      const total = evidence.length || 12;
      const score = scoreMetric?.value ?? 0;
      return { id: fw, name: fw.toUpperCase(), score, submitted, total };
    });
  }, [metrics]);

  const upcomingAudits = events
    .filter((e) => e.event_type === "audit" && e.status === "scheduled")
    .sort((a, b) => new Date(a.happened_at).getTime() - new Date(b.happened_at).getTime())
    .slice(0, 3);

  const openFindings = events.filter((e) => e.event_type === "audit_finding" && e.status !== "resolved").length;
  const overallScore = Math.round(frameworks.reduce((a, f) => a + f.score, 0) / frameworks.length) || 0;

  return (
    <Widget dataSource={dataSource}>
      <WidgetHeader title="Audit Readiness" subtitle="Framework scores and upcoming audits" dataSource={dataSource} />

      <div className="mb-4 flex items-center gap-4 rounded-xl border border-border bg-muted/40 p-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
          <ShieldCheck size={22} />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Overall readiness</span>
            <span className="text-lg font-bold text-foreground">{overallScore}%</span>
          </div>
          <Progress value={overallScore} className="mt-2 h-2" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {frameworks.map((fw) => {
          const pct = Math.round((fw.submitted / fw.total) * 100);
          return (
            <div key={fw.id} className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground">{fw.name}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    fw.score >= 90
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                      : fw.score >= 75
                      ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                      : "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                  )}
                >
                  {fw.score}%
                </Badge>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Evidence {fw.submitted}/{fw.total}</span>
                <span className="font-medium text-foreground">{pct}%</span>
              </div>
              <Progress value={pct} className="mt-1 h-1.5" />
            </div>
          );
        })}
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Upcoming audits</p>
        {upcomingAudits.length === 0 && (
          <p className="text-sm text-muted-foreground">No scheduled audits in selected window.</p>
        )}
        {upcomingAudits.map((audit) => (
          <div key={audit.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{audit.title}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(audit.happened_at), { addSuffix: true })}
            </span>
          </div>
        ))}
      </div>

      {openFindings > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <AlertTriangle size={14} />
          {openFindings} open audit finding{openFindings > 1 ? "s" : ""} require attention
        </div>
      )}
    </Widget>
  );
}
