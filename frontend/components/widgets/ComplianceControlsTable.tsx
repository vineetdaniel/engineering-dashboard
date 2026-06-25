"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Filter } from "lucide-react";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SectionProps } from "@/components/sections/types";

interface ControlRow {
  id: number;
  framework: string;
  controlId: string;
  title: string;
  requirement?: string;
  owner?: string;
  status: string;
  severity: string;
  evidenceUrl?: string;
  reviewedAt?: string;
  nextReviewAt?: string;
  notes?: string;
}

const FRAMEWORK_LABELS: Record<string, string> = {
  pci_dss: "PCI DSS",
  iso_27001: "ISO 27001",
};

const STATUS_STYLES: Record<string, string> = {
  passed: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  compliant: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
  non_compliant: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
  partial: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  pending: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  not_applicable: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
  high: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300",
  medium: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  low: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
};

export function ComplianceControlsTable({
  metrics,
  dataSource,
  className,
}: Pick<SectionProps, "metrics" | "dataSource"> & { className?: string }) {
  const [frameworkFilter, setFrameworkFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const controls = useMemo(() => {
    return metrics
      .filter((m) => m.metric_type === "compliance_control_status" && m.source === "compliance_manual")
      .map((m): ControlRow => ({
        id: m.id,
        framework: String(m.meta?.framework || m.entity || "unknown"),
        controlId: String(m.meta?.control_id || m.entity || ""),
        title: String(m.meta?.title || ""),
        requirement: m.meta?.requirement ? String(m.meta.requirement) : undefined,
        owner: m.meta?.owner ? String(m.meta.owner) : undefined,
        status: String(m.meta?.status || "pending"),
        severity: String(m.meta?.severity || "low"),
        evidenceUrl: m.meta?.evidence_url ? String(m.meta.evidence_url) : undefined,
        reviewedAt: m.meta?.reviewed_at ? String(m.meta.reviewed_at) : undefined,
        nextReviewAt: m.meta?.next_review_at ? String(m.meta.next_review_at) : undefined,
        notes: m.meta?.notes ? String(m.meta.notes) : undefined,
      }));
  }, [metrics]);

  const frameworks = useMemo(() => Array.from(new Set(controls.map((c) => c.framework))).sort(), [controls]);
  const statuses = useMemo(() => Array.from(new Set(controls.map((c) => c.status))).sort(), [controls]);

  const filtered = useMemo(() => {
    return controls.filter((c) => {
      if (frameworkFilter !== "all" && c.framework !== frameworkFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      return true;
    });
  }, [controls, frameworkFilter, statusFilter]);

  if (controls.length === 0) {
    return (
      <Widget className={cn("flex flex-col", className)} dataSource={dataSource}>
        <WidgetHeader title="Controls Register" subtitle="Uploaded compliance controls" dataSource={dataSource} />
        <div className="flex h-40 items-center justify-center px-5">
          <p className="text-sm text-muted-foreground">No uploaded controls yet. Use the upload panel above to add PCI DSS or ISO 27001 controls.</p>
        </div>
      </Widget>
    );
  }

  return (
    <Widget className={cn("flex flex-col", className)} dataSource={dataSource}>
      <WidgetHeader
        title="Controls Register"
        subtitle={`${filtered.length} of ${controls.length} uploaded controls`}
        badge={controls.length}
        dataSource={dataSource}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2 px-5">
        <Filter size={14} className="text-muted-foreground" />
        <div className="flex flex-wrap gap-2">
          <Button
            variant={frameworkFilter === "all" ? "accent" : "outline"}
            size="sm"
            onClick={() => setFrameworkFilter("all")}
          >
            All frameworks
          </Button>
          {frameworks.map((fw) => (
            <Button
              key={fw}
              variant={frameworkFilter === fw ? "accent" : "outline"}
              size="sm"
              onClick={() => setFrameworkFilter(fw)}
            >
              {FRAMEWORK_LABELS[fw] || fw}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={statusFilter === "all" ? "accent" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("all")}
          >
            All statuses
          </Button>
          {statuses.map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "accent" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </Button>
          ))}
        </div>
      </div>
      <div className="-mx-5 flex-1 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <th className="px-5 py-2">Control</th>
              <th className="px-5 py-2">Framework</th>
              <th className="px-5 py-2">Owner</th>
              <th className="px-5 py-2">Status</th>
              <th className="px-5 py-2">Severity</th>
              <th className="px-5 py-2">Reviewed</th>
              <th className="px-5 py-2">Next review</th>
              <th className="px-5 py-2 text-right">Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((row) => (
              <tr key={row.id} className="group transition-colors hover:bg-muted/50">
                <td className="px-5 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{row.controlId}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={row.title}>
                      {row.title}
                    </span>
                    {row.requirement && (
                      <span className="text-xs text-muted-foreground truncate max-w-[240px]" title={row.requirement}>
                        {row.requirement}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className="text-xs text-muted-foreground">{FRAMEWORK_LABELS[row.framework] || row.framework}</span>
                </td>
                <td className="px-5 py-3">
                  <span className="text-xs text-muted-foreground">{row.owner || "—"}</span>
                </td>
                <td className="px-5 py-3">
                  <Badge variant="outline" className={cn("text-xs", STATUS_STYLES[row.status] || STATUS_STYLES.pending)}>
                    {row.status}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <Badge variant="outline" className={cn("text-xs", SEVERITY_STYLES[row.severity] || SEVERITY_STYLES.low)}>
                    {row.severity}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <span className="text-xs text-muted-foreground">{row.reviewedAt || "—"}</span>
                </td>
                <td className="px-5 py-3">
                  <span className="text-xs text-muted-foreground">{row.nextReviewAt || "—"}</span>
                </td>
                <td className="px-5 py-3 text-right">
                  {row.evidenceUrl ? (
                    <a
                      href={row.evidenceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      Open <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Widget>
  );
}
