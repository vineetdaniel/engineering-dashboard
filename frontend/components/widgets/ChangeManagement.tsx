"use client";

import { useMemo } from "react";
import { GitPullRequest, ShieldCheck, AlertTriangle, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { Stat } from "./Stat";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/widgets/DataTable";
import type { DataTableRow } from "@/components/widgets/DataTable";
import { cn } from "@/lib/utils";

interface ChangeManagementProps {
  events: any[];
}

export function ChangeManagement({ events }: ChangeManagementProps) {
  const changes = useMemo(() =>
    events.filter((e) =>
      e.event_type === "change_request" || e.event_type === "release_deploy" || e.event_type === "deploy"
    ),
    [events]
  );

  const pendingApprovals = changes.filter((e) => e.status === "pending" || e.status === "open").length;
  const approved = changes.filter((e) => e.status === "approved").length;
  const rejected = changes.filter((e) => e.status === "rejected" || e.status === "rolled_back").length;
  const emergency = changes.filter((e) => e.meta?.emergency || e.severity === "critical").length;

  const riskScores = changes.map((e) => {
    const base = e.meta?.risk_score ?? 50;
    if (e.severity === "critical" || e.meta?.emergency) return Math.max(base, 80);
    if (e.severity === "high") return Math.max(base, 60);
    return base;
  });
  const avgRisk = riskScores.length ? Math.round(riskScores.reduce((a, b) => a + b, 0) / riskScores.length) : 0;

  const rows: DataTableRow[] = changes.slice(0, 8).map((e) => ({
    id: e.id,
    label: e.title,
    meta: `${e.entity} · ${e.meta?.squad || "—"}`,
    status: e.status,
    severity:
      e.severity === "critical"
        ? "critical"
        : e.severity === "high"
        ? "high"
        : e.meta?.emergency
        ? "high"
        : "medium",
  }));

  return (
    <Widget className="space-y-4">
      <WidgetHeader
        title="Change Management"
        subtitle="Pending approvals, risk score, and deployment flow"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          title="Pending Approval"
          value={pendingApprovals}
          icon={Clock}
          variant={pendingApprovals > 3 ? "warning" : "success"}
          trendInverse
          target="0"
        />
        <Stat
          title="Approved Today"
          value={approved}
          icon={CheckCircle2}
          variant="success"
        />
        <Stat
          title="Rejected / Rolled Back"
          value={rejected}
          icon={XCircle}
          variant={rejected > 0 ? "danger" : "success"}
          trendInverse
          target="0"
        />
        <Stat
          title="Emergency Changes"
          value={emergency}
          icon={AlertTriangle}
          variant={emergency > 0 ? "warning" : "success"}
          trendInverse
          target="0"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-muted/40 p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-indigo-600 dark:text-indigo-400" />
              <span className="text-sm font-semibold text-foreground">Average Change Risk Score</span>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                avgRisk >= 70
                  ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                  : avgRisk >= 45
                  ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                  : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
              )}
            >
              {avgRisk >= 70 ? "High" : avgRisk >= 45 ? "Medium" : "Low"}
            </Badge>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <span className="text-3xl font-bold text-foreground">{avgRisk}</span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
          <Progress value={avgRisk} className="mt-3 h-2" />
          <p className="mt-2 text-xs text-muted-foreground">
            Risk is elevated by emergency flag, severity, and blast radius metadata.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <p className="text-sm font-semibold text-foreground">Approval Pipeline</p>
          <div className="mt-3 space-y-3">
            <PipelineStep label="Open" count={pendingApprovals} total={changes.length} color="bg-amber-500" />
            <PipelineStep label="Approved" count={approved} total={changes.length} color="bg-emerald-500" />
            <PipelineStep label="Deployed" count={changes.filter((e) => e.status === "success").length} total={changes.length} color="bg-indigo-500" />
            <PipelineStep label="Rejected / Rolled back" count={rejected} total={changes.length} color="bg-rose-500" />
          </div>
        </div>
      </div>

      <DataTable
        title="Recent Changes"
        subtitle="Pending, approved, and rolled-back changes"
        rows={rows}
        emptyText="No changes in selected window"
      />
    </Widget>
  );
}

function PipelineStep({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{count} ({pct}%)</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
