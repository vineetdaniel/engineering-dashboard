"use client";

import { ShieldCheck, FileCheck, AlertCircle, Calendar } from "lucide-react";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Framework {
  id: string;
  name: string;
  status: "compliant" | "at_risk" | "non_compliant";
  progress: number;
  nextAudit: string;
  owner: string;
}

interface ComplianceWidgetProps {
  frameworks?: Framework[];
  className?: string;
}

const defaultFrameworks: Framework[] = [
  { id: "pci", name: "PCI DSS", status: "compliant", progress: 96, nextAudit: "Aug 15", owner: "Security" },
  { id: "soc2", name: "SOC 2 Type II", status: "at_risk", progress: 82, nextAudit: "Jul 30", owner: "Compliance" },
  { id: "gdpr", name: "GDPR", status: "compliant", progress: 94, nextAudit: "Sep 01", owner: "Legal" },
  { id: "iso27001", name: "ISO 27001", status: "at_risk", progress: 78, nextAudit: "Oct 12", owner: "Security" },
];

const statusConfig = {
  compliant: { icon: ShieldCheck, label: "Compliant", class: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" },
  at_risk: { icon: AlertCircle, label: "At risk", class: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300" },
  non_compliant: { icon: AlertCircle, label: "Non-compliant", class: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300" },
};

export function ComplianceWidget({ frameworks = defaultFrameworks, className }: ComplianceWidgetProps) {
  return (
    <Widget className={className}>
      <WidgetHeader
        title="Compliance Snapshot"
        subtitle="Framework readiness and upcoming audits"
      />

      <div className="space-y-4">
        {frameworks.map((fw) => {
          const config = statusConfig[fw.status];
          const StatusIcon = config.icon;
          return (
            <div
              key={fw.id}
              className="rounded-xl border bg-card p-4 transition hover:bg-muted/40"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted">
                    <FileCheck size={16} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{fw.name}</p>
                    <p className="text-xs text-muted-foreground">Owner: {fw.owner}</p>
                  </div>
                </div>
                <Badge variant="outline" className={cn("gap-1", config.class)}>
                  <StatusIcon size={12} />
                  {config.label}
                </Badge>
              </div>

              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Control completion</span>
                  <span className="font-medium">{fw.progress}%</span>
                </div>
                <Progress value={fw.progress} className="h-2" />
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar size={12} />
                Next audit: {fw.nextAudit}
              </div>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}
