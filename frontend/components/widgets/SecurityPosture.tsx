"use client";

import { ShieldCheck, AlertTriangle, Lock, FileCheck, Eye } from "lucide-react";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SecurityPostureProps {
  cves: any[];
  events: any[];
  className?: string;
}

export function SecurityPosture({ cves, events, className }: SecurityPostureProps) {
  const open = cves.filter((e) => e.status === "open");
  const critical = open.filter((e) => e.severity === "critical").length;
  const high = open.filter((e) => e.severity === "high").length;
  const medium = open.filter((e) => e.severity === "medium").length;
  const low = open.filter((e) => e.severity === "low").length;

  const secrets = events.filter((e) => e.event_type === "secret_scanning_alert" && e.status !== "resolved").length;
  const auditGaps = events.filter(
    (e) => e.event_type === "audit_log" && (e.severity === "high" || e.severity === "critical")
  ).length;

  // Weighted score: start at 100, deduct for findings
  const deductions = {
    critical: 12,
    high: 6,
    medium: 2,
    low: 0.5,
    secrets: 4,
    auditGap: 3,
  };
  const rawScore = Math.max(
    0,
    100 -
      critical * deductions.critical -
      high * deductions.high -
      medium * deductions.medium -
      low * deductions.low -
      secrets * deductions.secrets -
      auditGaps * deductions.auditGap
  );
  const score = Math.round(rawScore);

  const factors = [
    { id: "cve", label: "CVE management", value: Math.max(0, 100 - (critical * 12 + high * 6 + medium * 2)), icon: ShieldCheck },
    { id: "secrets", label: "Secrets hygiene", value: Math.max(0, 100 - secrets * 10), icon: Lock },
    { id: "audit", label: "Audit readiness", value: Math.max(0, 100 - auditGaps * 15), icon: Eye },
  ];

  const posture = score >= 85 ? "Strong" : score >= 60 ? "Fair" : "At Risk";

  return (
    <Widget className={className}>
      <WidgetHeader
        title="Security Posture"
        subtitle="Aggregate security health score"
        action={
          <Badge
            variant="outline"
            className={cn(
              score >= 85
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                : score >= 60
                ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
            )}
          >
            {score >= 60 ? <ShieldCheck size={12} className="mr-1" /> : <AlertTriangle size={12} className="mr-1" />}
            {posture}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall score</span>
            <span className={cn("text-3xl font-bold", score >= 85 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-rose-600")}>
              {score}
            </span>
          </div>
          <Progress value={score} className="h-3" />
          <p className="text-xs text-muted-foreground">
            Based on {open.length} open CVEs, {secrets} active secrets findings, and {auditGaps} high-severity audit gaps.
          </p>
        </div>

        <div className="space-y-3">
          {factors.map((factor) => {
            const Icon = factor.icon;
            return (
              <div key={factor.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Icon size={12} />
                    {factor.label}
                  </span>
                  <span className="font-medium">{factor.value}%</span>
                </div>
                <Progress value={factor.value} className="h-1.5" />
              </div>
            );
          })}
        </div>
      </div>
    </Widget>
  );
}
