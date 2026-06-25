"use client";

import { CheckCircle2, XCircle, GitBranch, Cloud, Layers, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface ConnectorStatusProps {
  health: any;
  onSync?: (source: string) => void;
  loading?: string | null;
  className?: string;
}

export function ConnectorStatus({ health, onSync, loading, className }: ConnectorStatusProps) {
  const connectors = health?.connectors || {};
  const entries = Object.entries(connectors);

  if (entries.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm",
        className
      )}
    >
      <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Integrations:</span>
      {entries.map(([name, status]: [string, any]) => {
        const Icon = icons[name] || Cloud;
        const ok = !!status.ok;
        return (
          <div
            key={name}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm transition shadow-sm",
              ok
                ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                : "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
            )}
          >
            <Icon size={16} />
            <span className="font-semibold">{labels[name] || name}</span>
            {ok ? (
              <CheckCircle2 size={14} className="text-emerald-700 dark:text-emerald-400" />
            ) : (
              <XCircle size={14} className="text-rose-700 dark:text-rose-400" />
            )}
            {onSync && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 h-6 w-6"
                onClick={() => onSync(name)}
                disabled={loading === name}
                aria-label={`Sync ${name}`}
              >
                <RefreshCw size={12} className={cn(loading === name && "animate-spin")} />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
