"use client";

import { useMemo } from "react";
import { Database, CloudOff, Clock, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface BackupDRStatusProps {
  events: any[];
}

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

const DEFAULT_BACKUPS = [
  { system: "Ledger DB", type: "Database", rpoHours: 4, lastBackupHours: 2, testStatus: "passed", drRegion: "us-west-2" },
  { system: "Payments core", type: "Database", rpoHours: 1, lastBackupHours: 0.5, testStatus: "passed", drRegion: "us-east-1" },
  { system: "Auth config", type: "Object storage", rpoHours: 24, lastBackupHours: 6, testStatus: "passed", drRegion: "eu-west-1" },
  { system: "Audit logs", type: "Object storage", rpoHours: 24, lastBackupHours: 28, testStatus: "failed", drRegion: "us-west-2" },
  { system: "KYC documents", type: "Object storage", rpoHours: 12, lastBackupHours: 10, testStatus: "pending", drRegion: "us-east-1" },
];

export function BackupDRStatus({ events }: BackupDRStatusProps) {
  const backups = useMemo(() => {
    const backupEvents = events.filter((e) => e.event_type === "backup_status" || e.event_type === "dr_test");
    if (!backupEvents.length) return DEFAULT_BACKUPS;

    const bySystem: Record<string, any> = {};
    backupEvents.forEach((e) => {
      const system = e.entity || e.meta?.system || "Unknown";
      if (!bySystem[system] || new Date(e.happened_at).getTime() > new Date(bySystem[system].happened_at).getTime()) {
        bySystem[system] = e;
      }
    });

    return Object.entries(bySystem).map(([system, e]) => ({
      system,
      type: e.meta?.type || "Database",
      rpoHours: e.meta?.rpo_hours || 24,
      lastBackupHours: Math.max(0, (Date.now() - new Date(e.meta?.last_backup_at || e.happened_at).getTime()) / (1000 * 60 * 60)),
      testStatus: e.meta?.test_status || e.status || "pending",
      drRegion: e.meta?.dr_region || "—",
    }));
  }, [events]);

  const failedTests = backups.filter((b) => b.testStatus === "failed").length;
  const rpoBreaches = backups.filter((b) => b.lastBackupHours > b.rpoHours).length;
  const healthy = backups.length - failedTests - rpoBreaches;

  return (
    <Widget>
      <WidgetHeader
        title="Backup & DR Health"
        subtitle="RPO compliance and last recovery test status"
      />

      <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-900 dark:bg-emerald-950">
          <p className="text-emerald-800 dark:text-emerald-300 font-bold text-lg">{healthy}</p>
          <p className="text-emerald-700 dark:text-emerald-400">Healthy</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 dark:border-rose-900 dark:bg-rose-950">
          <p className="text-rose-800 dark:text-rose-300 font-bold text-lg">{failedTests}</p>
          <p className="text-rose-700 dark:text-rose-400">Failed tests</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 dark:border-amber-900 dark:bg-amber-950">
          <p className="text-amber-800 dark:text-amber-300 font-bold text-lg">{rpoBreaches}</p>
          <p className="text-amber-700 dark:text-amber-400">RPO breaches</p>
        </div>
      </div>

      <div className="space-y-3">
        {backups.map((b) => {
          const rpoPct = Math.min(100, (b.lastBackupHours / b.rpoHours) * 100);
          const rpoBreached = b.lastBackupHours > b.rpoHours;
          return (
            <div key={b.system} className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <Database size={14} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{b.system}</p>
                    <p className="text-xs text-muted-foreground">{b.type} · DR: {b.drRegion}</p>
                  </div>
                </div>
                <StatusBadge status={b.testStatus} />
              </div>

              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Last backup</span>
                  <span className={cn("font-semibold", rpoBreached ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>
                    {b.lastBackupHours < 1 ? `${Math.round(b.lastBackupHours * 60)}m ago` : `${Math.round(b.lastBackupHours)}h ago`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">RPO target</span>
                  <span className="font-medium text-foreground">{b.rpoHours}h</span>
                </div>
                <Progress value={rpoPct} className="h-1.5" />
              </div>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "passed") {
    return (
      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 gap-1">
        <CheckCircle2 size={12} /> Passed
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 gap-1">
        <XCircle size={12} /> Failed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300 gap-1">
      <AlertTriangle size={12} /> Pending
    </Badge>
  );
}
