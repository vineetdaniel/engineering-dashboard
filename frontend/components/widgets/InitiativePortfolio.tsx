"use client";

import { FolderKanban, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { InitiativeBucket, StrategyActionItem } from "@/lib/api";

interface InitiativePortfolioProps {
  buckets: InitiativeBucket[];
  actions: StrategyActionItem[];
}

const ICONS: Record<string, string> = {
  platform_reliability: "🔧",
  delivery_velocity: "🚀",
  payments_fintech: "💳",
  cost_efficiency: "💰",
  compliance_governance: "🛡️",
  ai_strategy: "🤖",
  team_capacity: "👥",
  growth_levers: "📈",
};

function statusVariant(status: string) {
  switch (status) {
    case "critical":
      return "danger";
    case "at_risk":
      return "warning";
    case "healthy":
      return "success";
    default:
      return "secondary";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "critical":
      return "Critical";
    case "at_risk":
      return "At risk";
    case "healthy":
      return "Healthy";
    default:
      return "Tracking";
  }
}

function statusScore(status: string) {
  switch (status) {
    case "critical":
      return 25;
    case "at_risk":
      return 55;
    case "healthy":
      return 90;
    default:
      return 0;
  }
}

export function InitiativePortfolio({ buckets, actions }: InitiativePortfolioProps) {
  const actionById = Object.fromEntries(actions.map((a) => [a.id, a]));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban size={18} className="text-primary" />
            <CardTitle>Initiative Portfolio</CardTitle>
          </div>
          <Badge variant="outline">{buckets.length} initiatives</Badge>
        </div>
        <CardDescription>
          Action items grouped into strategic buckets so you can see which themes need attention.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {buckets.map((bucket) => (
          <div
            key={bucket.id}
            className={cn(
              "rounded-xl border border-border bg-card/50 p-4 transition hover:bg-card hover:shadow-sm",
              bucket.status === "critical" && "border-rose-200 dark:border-rose-900",
              bucket.status === "at_risk" && "border-amber-200 dark:border-amber-900"
            )}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{ICONS[bucket.key] || "📂"}</span>
                  <h4 className="text-sm font-semibold">{bucket.label}</h4>
                  <Badge variant={statusVariant(bucket.status)}>{statusLabel(bucket.status)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{bucket.description}</p>

                <div className="flex flex-wrap gap-2 pt-1">
                  {bucket.sections.map((section) => (
                    <a
                      key={section}
                      href={`?section=${section}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs hover:bg-muted"
                    >
                      {section} <ArrowRight size={10} />
                    </a>
                  ))}
                </div>
              </div>

              <div className="shrink-0 lg:w-56">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Health</span>
                  <span className="font-medium">{bucket.open_items} open{bucket.near_term_items > 0 && ` · ${bucket.near_term_items} near-term`}</span>
                </div>
                <Progress value={statusScore(bucket.status)} className="h-1.5" />
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {bucket.critical_items > 0 && (
                    <span className="text-rose-600 dark:text-rose-400">{bucket.critical_items} critical</span>
                  )}
                  {bucket.high_items > 0 && (
                    <span className="text-amber-600 dark:text-amber-400">{bucket.high_items} high</span>
                  )}
                  {bucket.critical_items === 0 && bucket.high_items === 0 && bucket.open_items === 0 && (
                    <span className="text-muted-foreground">No active actions</span>
                  )}
                  {bucket.critical_items === 0 && bucket.high_items === 0 && bucket.open_items > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400">All lower priority</span>
                  )}
                </div>
              </div>
            </div>

            {bucket.action_ids.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-border pt-3">
                {bucket.action_ids.slice(0, 3).map((id) => {
                  const action = actionById[id];
                  if (!action) return null;
                  return (
                    <div key={id} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{action.title}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{action.due_hint ? `Due ${action.due_hint}` : "No due hint"}</span>
                      </div>
                      <Badge variant={action.priority === "critical" ? "danger" : action.priority === "high" ? "warning" : "secondary"}>
                        {action.priority}
                      </Badge>
                    </div>
                  );
                })}
                {bucket.action_ids.length > 3 && (
                  <div className="text-xs text-muted-foreground">
                    +{bucket.action_ids.length - 3} more action(s)
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
