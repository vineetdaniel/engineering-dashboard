"use client";

import { useEffect, useState } from "react";
import { RefreshCw, WifiOff, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SourceStatus {
  name: string;
  lastSync: Date;
  latencyMs: number;
  healthy: boolean;
}

interface DataFreshnessProps {
  lastUpdated?: Date | null;
  backendOk?: boolean;
  onRefresh?: () => void;
}

export function DataFreshness({ lastUpdated, backendOk = true, onRefresh }: DataFreshnessProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(t);
  }, []);

  const sources: SourceStatus[] = [
    {
      name: "Metrics",
      lastSync: lastUpdated || new Date(now.getTime() - 120_000),
      latencyMs: 85,
      healthy: backendOk,
    },
    {
      name: "Events",
      lastSync: lastUpdated || new Date(now.getTime() - 95_000),
      latencyMs: 120,
      healthy: backendOk,
    },
    {
      name: "Connectors",
      lastSync: new Date(now.getTime() - 300_000),
      latencyMs: 250,
      healthy: backendOk,
    },
  ];

  const staleThresholdMs = 5 * 60 * 1000;

  return (
    <Widget>
      <WidgetHeader
        title="Data Freshness"
        subtitle="Source latency and staleness"
        action={
          onRefresh && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh} aria-label="Refresh data">
              <RefreshCw size={14} />
            </Button>
          )
        }
      />

      {!backendOk && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <WifiOff size={14} />
          Backend offline — data may be stale.
        </div>
      )}

      <div className="space-y-2">
        {sources.map((source) => {
          const ageMs = now.getTime() - source.lastSync.getTime();
          const stale = ageMs > staleThresholdMs;
          const ageText = ageMs < 60_000 ? "just now" : `${Math.round(ageMs / 60_000)}m ago`;
          return (
            <div
              key={source.name}
              className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                {stale ? (
                  <AlertTriangle size={14} className="text-amber-500" />
                ) : (
                  <CheckCircle2 size={14} className="text-emerald-500" />
                )}
                <span className="text-sm font-medium text-foreground">{source.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  <Clock size={10} className="mr-1 inline" />
                  {ageText}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    stale
                      ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                      : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                  )}
                >
                  {source.latencyMs}ms
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}
