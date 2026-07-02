"use client";

import { ShieldCheck, Clock, Calendar, AlertTriangle } from "lucide-react";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";
import { Stat } from "@/components/widgets/Stat";
import { TrendChart } from "@/components/TrendChart";
import { cn } from "@/lib/utils";

interface SecurityRemediationProps {
  cves: any[];
  className?: string;
}

export function SecurityRemediation({ cves, className }: SecurityRemediationProps) {
  // MTTR heuristic: average age of resolved CVEs (if we had resolved_at we would use it)
  const resolved = cves.filter((e) => e.status === "resolved" || e.status === "dismissed");
  const open = cves.filter((e) => e.status === "open");

  const mttrHours =
    resolved.length > 0
      ? Math.round(
          resolved.reduce((sum, e) => {
            const age = e.created_at
              ? (Date.now() - new Date(e.created_at).getTime()) / (1000 * 60 * 60)
              : 48;
            return sum + age;
          }, 0) / resolved.length
        )
      : 48;

  const aging = {
    "<7d": open.filter((e) => {
      if (!e.created_at) return false;
      const age = (Date.now() - new Date(e.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return age < 7;
    }).length,
    "7-30d": open.filter((e) => {
      if (!e.created_at) return false;
      const age = (Date.now() - new Date(e.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return age >= 7 && age <= 30;
    }).length,
    ">30d": open.filter((e) => {
      if (!e.created_at) return false;
      const age = (Date.now() - new Date(e.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return age > 30;
    }).length,
  };

  const agingData = [
    { label: "<7d", value: aging["<7d"] },
    { label: "7-30d", value: aging["7-30d"] },
    { label: ">30d", value: aging[">30d"] },
  ];

  const criticalOpen = open.filter((e) => e.severity === "critical").length;

  return (
    <Widget className={className}>
      <WidgetHeader
        title="Security Remediation"
        subtitle="Mean time to remediate and CVE aging"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          title="MTTR"
          value={`${mttrHours}h`}
          icon={Clock}
          variant={mttrHours <= 72 ? "success" : "warning"}
          target="<72h"
        />
        <Stat
          title="Open CVEs"
          value={open.length}
          icon={ShieldCheck}
          variant={open.length > 20 ? "warning" : "default"}
        />
        <Stat
          title="Critical Open"
          value={criticalOpen}
          icon={AlertTriangle}
          variant={criticalOpen > 0 ? "danger" : "success"}
          trendInverse
          target="0"
        />
        <Stat
          title="Resolved This Period"
          value={resolved.length}
          icon={Calendar}
          variant="success"
        />
      </div>

      <div className={cn("mt-4 rounded-xl border p-4", criticalOpen > 0 ? "border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/30" : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30")}>
        <div className="flex items-center gap-2">
          {criticalOpen > 0 ? <AlertTriangle size={16} className="text-rose-600" /> : <ShieldCheck size={16} className="text-emerald-600" />}
          <span className={cn("text-sm font-medium", criticalOpen > 0 ? "text-rose-800 dark:text-rose-200" : "text-emerald-800 dark:text-emerald-200")}>
            {criticalOpen > 0 ? `${criticalOpen} critical CVE${criticalOpen === 1 ? "" : "s"} need immediate remediation` : "No critical CVEs open — posture is stable"}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <TrendChart
          title="CVE Aging Distribution"
          subtitle="Open findings by age bucket"
          data={agingData}
          type="bar"
          color="#6366f1"
        />
      </div>
    </Widget>
  );
}
