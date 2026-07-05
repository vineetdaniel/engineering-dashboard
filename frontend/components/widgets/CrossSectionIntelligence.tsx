"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, ArrowUpRight, ArrowDownRight, Minus, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getStrategyIntelligence, type ApiFilters, type IntelligencePanelOut } from "@/lib/api";

interface CrossSectionIntelligenceProps {
  filters?: ApiFilters;
}

const ICONS: Record<string, string> = {
  engineering: "🛠️",
  operations: "🚨",
  payments: "💳",
  cost: "💰",
  security: "🛡️",
  compliance: "📋",
  product: "🎫",
};

function statusVariant(status: string) {
  switch (status) {
    case "healthy":
      return "success";
    case "at_risk":
      return "warning";
    case "critical":
      return "danger";
    default:
      return "secondary";
  }
}

function formatValue(signal: { value: number | null; value_text: string | null; unit?: string | null }) {
  if (signal.value == null) return signal.value_text || "—";
  const unit = signal.unit || "";
  if (unit === "$") return `$${signal.value.toLocaleString()}`;
  if (unit === "%") return `${signal.value.toFixed(2)}%`;
  return `${Math.round(signal.value).toLocaleString()} ${unit}`.trim();
}

export function CrossSectionIntelligence({ filters }: CrossSectionIntelligenceProps) {
  const [panel, setPanel] = useState<IntelligencePanelOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchPanel() {
    setLoading(true);
    setError(null);
    try {
      const res = await getStrategyIntelligence(filters);
      setPanel(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load intelligence");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPanel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters?.dateRange, filters?.squad, filters?.environment]);

  const bySection = useMemo(() => {
    if (!panel) return {};
    const map: Record<string, typeof panel.signals> = {};
    for (const signal of panel.signals) {
      if (!map[signal.section]) map[signal.section] = [];
      map[signal.section].push(signal);
    }
    return map;
  }, [panel]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid size={18} className="text-primary" />
            <CardTitle>Cross-Section Intelligence</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchPanel} disabled={loading}>
            <RefreshCw size={14} className={cn(loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
        <CardDescription>
          Live signals pulled from engineering, operations, payments, cost, security, compliance, and product.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
            {error}
          </div>
        )}

        {!panel && !error && (
          <div className="text-center text-xs text-muted-foreground">Loading cross-section signals...</div>
        )}

        {panel && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(bySection).map(([section, signals]) => (
              <div key={section} className="rounded-xl border border-border bg-card/50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-lg">{ICONS[section] || "📊"}</span>
                  <h4 className="text-sm font-semibold capitalize">{section}</h4>
                  <a
                    href={`?section=${section}`}
                    className="ml-auto text-muted-foreground hover:text-foreground"
                    title={`Open ${section} section`}
                  >
                    <ArrowUpRight size={14} />
                  </a>
                </div>
                <div className="space-y-2">
                  {signals.map((signal) => (
                    <div key={signal.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{signal.label}</span>
                        {signal.trend && signal.trend !== "flat" && (
                          <span className={cn("text-xs", signal.trend === "up" ? "text-emerald-500" : "text-rose-500")}>
                            {signal.trend === "up" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                          </span>
                        )}
                        {signal.trend === "flat" && <Minus size={12} className="text-muted-foreground" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatValue(signal)}</span>
                        <Badge variant={statusVariant(signal.status)}>{signal.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {panel?.updated_at && (
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date(panel.updated_at).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
