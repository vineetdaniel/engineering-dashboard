"use client";

import { Rocket, GitBranch, RotateCcw, CheckCircle2 } from "lucide-react";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Release {
  id: number;
  title: string;
  entity?: string;
  status?: string;
  happened_at?: string;
  meta?: any;
}

interface ReleaseTimelineProps {
  releases: Release[];
  className?: string;
  dataSource?: "live" | "seed" | "mixed" | "dummy";
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

const statusConfig: Record<string, { icon: typeof CheckCircle2; class: string; label: string }> = {
  success: { icon: CheckCircle2, class: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300", label: "Success" },
  rolled_back: { icon: RotateCcw, class: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300", label: "Rolled back" },
  failed: { icon: RotateCcw, class: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300", label: "Failed" },
  pending: { icon: Rocket, class: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300", label: "Pending" },
};

export function ReleaseTimeline({ releases, className, dataSource }: ReleaseTimelineProps) {
  const recent = releases.slice(0, 8);

  return (
    <Widget dataSource={dataSource} className={className}>
      <WidgetHeader
        title="Recent Releases"
        subtitle="Production deploys and rollouts"
        dataSource={dataSource}
      />

      <div className="space-y-3">
        {recent.length === 0 && (
          <p className="text-sm text-muted-foreground">No recent releases tracked.</p>
        )}
        {recent.map((release, i) => {
          const status = statusConfig[release.status || "success"] || statusConfig.success;
          const StatusIcon = status.icon;
          const version = release.meta?.version || release.title.match(/v\d+\.\d+\.\d+/)?.[0] || "—";
          return (
            <div key={release.id} className="flex items-start gap-3">
              {i !== recent.length - 1 && (
                <div className="absolute ml-4 mt-6 h-full w-px bg-border" />
              )}
              <div className={cn("relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border", status.class)}>
                <GitBranch size={14} />
              </div>
              <div className="flex-1 pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{release.entity || "service"} {version}</p>
                  <Badge variant="outline" className={status.class}>
                    <StatusIcon size={12} className="mr-1" />
                    {status.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{release.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(release.happened_at)} · {release.meta?.squad || "platform"}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}
