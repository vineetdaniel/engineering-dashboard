"use client";

import { CheckCircle2, XCircle, GitBranch, Cloud, Layers, RefreshCw, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";
import { cn } from "@/lib/utils";

const icons: Record<string, React.ElementType> = {
  github: GitBranch,
  jira: Layers,
  observability: Cloud,
};

const labels: Record<string, string> = {
  github: "GitHub",
  jira: "Jira",
  observability: "Observability",
};

interface ConnectorManagerProps {
  health: any;
  onSync: (source: string) => void;
  syncLoading: string | null;
  className?: string;
}

export function ConnectorManager({ health, onSync, syncLoading, className }: ConnectorManagerProps) {
  const connectors = health?.connectors || {};
  const entries = Object.entries(connectors);

  if (entries.length === 0) {
    return (
      <Widget className={className}>
        <WidgetHeader title="Connectors" subtitle="No integrations configured" />
        <div className="flex items-center justify-center rounded-lg border border-dashed py-10 text-center">
          <div className="space-y-2">
            <Link2 className="mx-auto text-muted-foreground" size={28} />
            <p className="text-sm text-muted-foreground">Connect GitHub, Jira, or Datadog to populate the dashboard.</p>
            <Button variant="outline" size="sm">Add connector</Button>
          </div>
        </div>
      </Widget>
    );
  }

  return (
    <Widget className={className}>
      <WidgetHeader
        title="Connector Health"
        subtitle="Live integration status and manual sync controls"
        action={
          <Button variant="outline" size="sm" className="gap-2" onClick={() => onSync("all")} disabled={syncLoading === "all"}>
            <RefreshCw size={14} className={cn(syncLoading === "all" && "animate-spin")} />
            Sync all
          </Button>
        }
      />

      <div className="divide-y divide-border overflow-hidden rounded-lg border">
        {entries.map(([name, status]: [string, any]) => {
          const Icon = icons[name] || Cloud;
          const ok = !!status.ok;
          const lastSynced = status.last_synced || "Never";
          const error = status.error || null;
          return (
            <div
              key={name}
              className="flex flex-col gap-3 p-4 transition hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg border", ok ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950" : "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950")}>
                  <Icon size={18} className={ok ? "text-emerald-600" : "text-rose-600"} />
                </div>
                <div className="space-y-0.5">
                  <p className="font-medium">{labels[name] || name}</p>
                  <p className="text-xs text-muted-foreground">Last synced {lastSynced}</p>
                  {error && <p className="max-w-xs text-xs text-rose-600">{error}</p>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("gap-1", ok ? "border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300" : "border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300")}>
                  {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {ok ? "Connected" : "Disconnected"}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => onSync(name)}
                  disabled={syncLoading === name}
                >
                  <RefreshCw size={14} className={cn(syncLoading === name && "animate-spin")} />
                  Sync
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}
