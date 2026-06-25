"use client";

import { useMemo } from "react";
import { Activity, Clock, AlertTriangle, Server } from "lucide-react";
import { Widget, WidgetHeader, Stat } from "@/components/widgets";
import { TrendChart } from "@/components/TrendChart";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface JenkinsCIPanelProps {
  metrics: any[];
  events: any[];
  dataSource?: "live" | "seed" | "mixed" | "dummy";
  maxFailures?: number;
}

function formatDuration(ms?: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${minutes}m ${rem}s`;
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return "just now";
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function statusBadge(result?: string) {
  switch (result?.toUpperCase()) {
    case "SUCCESS":
      return { variant: "success" as const, label: "Success" };
    case "FAILURE":
      return { variant: "danger" as const, label: "Failed" };
    case "UNSTABLE":
      return { variant: "warning" as const, label: "Unstable" };
    case "ABORTED":
      return { variant: "secondary" as const, label: "Aborted" };
    case "IN_PROGRESS":
      return { variant: "info" as const, label: "Running" };
    default:
      return { variant: "secondary" as const, label: result || "Unknown" };
  }
}

export function JenkinsCIPanel({ metrics, events, dataSource, maxFailures = 8 }: JenkinsCIPanelProps) {
  const jenkinsMetrics = useMemo(() => metrics.filter((m) => m.source === "jenkins"), [metrics]);
  const jenkinsEvents = useMemo(() => events.filter((e) => e.source === "jenkins"), [events]);

  const ciPassRate = jenkinsMetrics.find((m) => m.metric_type === "ci_pass_rate")?.value;
  const avgDuration = jenkinsMetrics.find((m) => m.metric_type === "ci_avg_duration_ms")?.value;
  const jobsCount = new Set(jenkinsMetrics.filter((m) => m.metric_type === "build_status").map((m) => m.entity)).size;

  const failures = useMemo(
    () =>
      jenkinsEvents
        .filter((e) => e.event_type === "ci_failure")
        .sort((a, b) => new Date(b.happened_at || 0).getTime() - new Date(a.happened_at || 0).getTime()),
    [jenkinsEvents]
  );

  const passRateSeries = useMemo(() => {
    const series = jenkinsMetrics
      .filter((m) => m.metric_type === "ci_pass_rate")
      .slice(0, 12)
      .map((m, i) => ({ label: `B${i + 1}`, value: m.value ?? 0 }));
    return series.length > 1
      ? series
      : [
          { label: "Mon", value: 94 },
          { label: "Tue", value: 95 },
          { label: "Wed", value: 96 },
          { label: "Thu", value: 97 },
          { label: "Fri", value: 97.4 },
        ];
  }, [jenkinsMetrics]);

  const hasRealData = jenkinsMetrics.length > 0 || jenkinsEvents.length > 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          title="CI Pass Rate"
          value={ciPassRate != null ? `${ciPassRate}%` : "97.4%"}
          icon={Activity}
          variant={ciPassRate != null && ciPassRate < 95 ? "warning" : "success"}
          target=">95%"
          sparklineData={passRateSeries.map((s) => s.value)}
        />
        <Stat
          title="Avg Build Duration"
          value={avgDuration != null ? formatDuration(avgDuration) : "4m 12s"}
          icon={Clock}
          variant="success"
        />
        <Stat
          title="Recent Failures"
          value={failures.length}
          icon={AlertTriangle}
          variant={failures.length > 0 ? "warning" : "success"}
          trendInverse
          target="0"
        />
        <Stat
          title="Jenkins Jobs"
          value={jobsCount > 0 ? jobsCount : "—"}
          icon={Server}
          variant="success"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendChart
            title="CI Pass Rate Trend"
            subtitle={hasRealData ? "Per sync pass rate" : "Sample trend"}
            data={passRateSeries}
            type="area"
            color="#10b981"
            target={95}
            targetLabel="Target >95%"
            className="h-64"
            dataSource={dataSource}
          />
        </div>
        <Widget className="flex flex-col" dataSource={dataSource}>
          <WidgetHeader title="Recent CI Failures" subtitle="Jenkins builds that failed or were unstable" badge={failures.length > 0 ? failures.length : undefined} dataSource={dataSource} />
          <div className="-mx-5 flex-1 overflow-x-auto">
            {failures.length === 0 ? (
              <div className="flex h-48 items-center justify-center px-5">
                <p className="text-sm text-muted-foreground">No recent CI failures — pipelines are healthy.</p>
              </div>
            ) : (
              <table className="w-full min-w-[440px] text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <th className="px-5 py-2">Job</th>
                    <th className="px-5 py-2">Build</th>
                    <th className="px-5 py-2">Result</th>
                    <th className="px-5 py-2 text-right">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {failures.slice(0, maxFailures).map((failure) => {
                    const result = failure.meta?.result || failure.status || "UNKNOWN";
                    const badge = statusBadge(result);
                    return (
                      <tr key={failure.id} className="transition-colors hover:bg-muted/50">
                        <td className="px-5 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground truncate max-w-[200px]">{failure.entity}</span>
                            {failure.meta?.job_url && (
                              <a
                                href={failure.meta.job_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-0.5 truncate text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                              >
                                Open job
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {failure.meta?.build_url ? (
                            <a
                              href={failure.meta.build_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-foreground hover:text-indigo-600 dark:hover:text-indigo-400"
                            >
                              #{failure.meta?.build_number}
                            </a>
                          ) : (
                            <span className="text-foreground">#{failure.meta?.build_number}</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={badge.variant} className={cn("text-[10px] capitalize")}>
                            {badge.label}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right text-xs text-muted-foreground">{timeAgo(failure.happened_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Widget>
      </div>
    </div>
  );
}
