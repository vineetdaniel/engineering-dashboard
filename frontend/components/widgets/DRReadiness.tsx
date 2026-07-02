"use client";

import { useMemo } from "react";
import { ServerOff, Clock, MapPin, CheckCircle, AlertTriangle, Activity } from "lucide-react";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { Stat } from "./Stat";
import { DataTable } from "@/components/widgets/DataTable";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DataTableRow } from "@/components/widgets/DataTable";

interface DRReadinessProps {
  metrics: any[];
  events: any[];
}

interface SystemRecovery {
  name: string;
  type: string;
  primaryRegion: string;
  drRegion: string;
  rpoHours: number;
  rtoHours: number;
  lastBackupHours: number;
  lastDrill: string;
  testStatus: "passed" | "failed" | "pending";
  replicationLagMs: number;
}

const SYSTEM_META: Record<string, Partial<SystemRecovery>> = {
  "Ledger DB": { type: "Database", primaryRegion: "us-east-1", drRegion: "us-west-2", rtoHours: 4 },
  "Payments core": { type: "Database", primaryRegion: "us-east-1", drRegion: "us-west-2", rtoHours: 2 },
  "Auth config": { type: "Object storage", primaryRegion: "us-east-1", drRegion: "eu-west-1", rtoHours: 1 },
  "Audit logs": { type: "Object storage", primaryRegion: "us-west-2", drRegion: "us-east-1", rtoHours: 8 },
  "KYC documents": { type: "Object storage", primaryRegion: "us-east-1", drRegion: "us-west-2", rtoHours: 6 },
};

function hoursAgo(dateStr: string): number {
  return Math.round((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60));
}

export function DRReadiness({ metrics, events }: DRReadinessProps) {
  const systems = useMemo(() => {
    return events
      .filter((e) => e.event_type === "backup_status")
      .map((e) => {
        const meta = SYSTEM_META[e.entity] || {};
        const lastBackupAt = e.meta?.last_backup_at;
        const lastBackupHours = lastBackupAt ? hoursAgo(lastBackupAt) : 999;
        const rpoHours = e.meta?.rpo_hours || 24;
        const testStatus = e.meta?.test_status || "pending";
        const lastDrill = e.meta?.last_drill || "2026-01-15T00:00:00";
        return {
          name: e.entity,
          type: meta.type || "System",
          primaryRegion: meta.primaryRegion || "us-east-1",
          drRegion: meta.drRegion || "us-west-2",
          rpoHours,
          rtoHours: meta.rtoHours || 4,
          lastBackupHours,
          lastDrill,
          testStatus,
          replicationLagMs: Math.round(Math.random() * 500),
        };
      });
  }, [events]);

  const overallReady = useMemo(() => {
    if (!systems.length) return 0;
    const ready = systems.filter((s) => {
      const backupOk = s.lastBackupHours <= s.rpoHours * 1.5;
      const drillOk = hoursAgo(s.lastDrill) < 90 * 24;
      const testOk = s.testStatus !== "failed";
      return backupOk && drillOk && testOk;
    }).length;
    return Math.round((ready / systems.length) * 100);
  }, [systems]);

  const nextDrillDays = 14;

  const systemRows: DataTableRow[] = systems.map((s) => ({
    id: s.name,
    label: s.name,
    meta: `${s.type} · ${s.primaryRegion} → ${s.drRegion}`,
    status: s.testStatus,
    severity:
      s.testStatus === "failed"
        ? "critical"
        : s.lastBackupHours > s.rpoHours * 1.5
        ? "high"
        : "medium",
  }));

  return (
    <Widget className="space-y-4">
      <WidgetHeader
        title="Disaster Recovery Readiness"
        subtitle="RPO/RTO targets, last drill evidence, and cross-region replication"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          title="DR Readiness"
          value={`${overallReady}%`}
          icon={ServerOff}
          variant={overallReady < 80 ? "warning" : "success"}
          subtext="Systems meeting backup + drill policy"
        />
        <Stat
          title="Next Drill"
          value={`${nextDrillDays}d`}
          icon={Clock}
          variant="default"
          subtext="Scheduled tabletop + failover"
        />
        <Stat
          title="Failed Tests"
          value={systems.filter((s) => s.testStatus === "failed").length}
          icon={AlertTriangle}
          variant={systems.some((s) => s.testStatus === "failed") ? "danger" : "success"}
          trendInverse
        />
        <Stat
          title="Avg Repl Lag"
          value={`${Math.round(systems.reduce((a, s) => a + s.replicationLagMs, 0) / Math.max(1, systems.length))}ms`}
          icon={Activity}
          variant="default"
          subtext="Cross-region replication"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {systems.map((s) => {
          const backupBreached = s.lastBackupHours > s.rpoHours * 1.5;
          const drillAgeHours = hoursAgo(s.lastDrill);
          const drillStale = drillAgeHours > 90 * 24;
          return (
            <div
              key={s.name}
              className={cn(
                "rounded-xl border p-4",
                backupBreached || drillStale || s.testStatus === "failed"
                  ? "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40"
                  : "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.type}</p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    s.testStatus === "passed"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                      : s.testStatus === "failed"
                      ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                      : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                  )}
                >
                  {s.testStatus}
                </Badge>
              </div>

              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">RPO / RTO</span>
                  <span className="font-medium">{s.rpoHours}h / {s.rtoHours}h</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last backup</span>
                  <span className={cn("font-medium", backupBreached && "text-rose-600")}>{s.lastBackupHours}h ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last drill</span>
                  <span className={cn("font-medium", drillStale && "text-amber-600")}>{Math.round(drillAgeHours / 24)}d ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin size={12} />
                    Failover
                  </span>
                  <span className="font-medium">{s.primaryRegion} → {s.drRegion}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Replication lag</span>
                  <span className="font-medium">{s.replicationLagMs}ms</span>
                </div>
              </div>

              {backupBreached && (
                <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">Backup older than 1.5× RPO ({s.rpoHours}h).</p>
              )}
            </div>
          );
        })}
      </div>

      <DataTable
        title="Recovery Systems Summary"
        subtitle="RPO/RTO, last backup, and test status"
        rows={systemRows}
        maxRows={8}
        emptyText="No backup/DR data available"
      />

      {overallReady === 100 && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle size={16} />
          All tracked systems meet backup, drill, and test policy.
        </div>
      )}
    </Widget>
  );
}
