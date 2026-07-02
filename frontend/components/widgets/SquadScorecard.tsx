"use client";

import { Users, GitPullRequest, Bug, Zap, Wallet, Activity } from "lucide-react";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface SquadScorecardProps {
  metrics: any[];
  events: any[];
  className?: string;
  dataSource?: "live" | "seed" | "mixed" | "dummy";
}

const SQUADS = ["platform", "payments", "risk", "data"];

export function SquadScorecard({ metrics, events, className, dataSource }: SquadScorecardProps) {
  const cards = SQUADS.map((squad) => {
    const openPRs = metrics
      .filter((m) => m.metric_type === "open_prs" && (m.meta?.squad === squad || m.entity?.includes(squad)))
      .reduce((a, m) => a + (m.value || 0), 0);
    const openBugs = metrics
      .filter((m) => m.metric_type === "open_bugs" && (m.meta?.squad === squad || m.entity?.includes(squad)))
      .reduce((a, m) => a + (m.value || 0), 0);
    const incidents = events.filter(
      (e) => e.event_type === "incident" && e.status !== "resolved" && (e.meta?.squad === squad || e.entity?.includes(squad))
    ).length;
    const spend = metrics
      .filter((m) => m.metric_type === "cloud_spend_mtd" && (m.meta?.squad === squad || m.entity?.includes(squad)))
      .reduce((a, m) => a + (m.value || 0), 0);
    const uptime = metrics
      .filter((m) => m.metric_type === "uptime_pct" && (m.meta?.squad === squad || m.entity?.includes(squad)))
      .map((m) => m.value)
      .pop() ?? 99.9;

    const healthScore = Math.round(
      Math.min(100, Math.max(0, 100 - incidents * 10 - openBugs * 0.5 - (100 - uptime) * 5))
    );

    return {
      squad,
      openPRs: Math.round(openPRs),
      openBugs: Math.round(openBugs),
      incidents,
      spend,
      uptime,
      healthScore,
    };
  });

  return (
    <Widget className={className} dataSource={dataSource}>
      <WidgetHeader title="Squad Health" subtitle="Key signals by team" dataSource={dataSource} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.squad}
            className="rounded-xl border border-border bg-card p-4 transition hover:bg-muted/40"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  <Users size={14} />
                </div>
                <p className="font-semibold capitalize text-foreground">{card.squad}</p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "font-semibold",
                  card.healthScore >= 85
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                    : card.healthScore >= 60
                    ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                    : "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                )}
              >
                {card.healthScore}%
              </Badge>
            </div>

            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Squad health</span>
                <span className="font-bold text-foreground">{card.healthScore}%</span>
              </div>
              <Progress value={card.healthScore} className="h-1.5" />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-border/60 bg-muted/70 p-2 dark:bg-card">
                <div className="flex items-center gap-1 font-medium text-muted-foreground">
                  <GitPullRequest size={12} /> PRs
                </div>
                <p className="font-bold text-foreground">{card.openPRs}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/70 p-2 dark:bg-card">
                <div className="flex items-center gap-1 font-medium text-muted-foreground">
                  <Bug size={12} /> Bugs
                </div>
                <p className="font-bold text-foreground">{card.openBugs}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/70 p-2 dark:bg-card">
                <div className="flex items-center gap-1 font-medium text-muted-foreground">
                  <Zap size={12} /> Incidents
                </div>
                <p className={cn("font-bold", card.incidents > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>{card.incidents}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/70 p-2 dark:bg-card">
                <div className="flex items-center gap-1 font-medium text-muted-foreground">
                  <Wallet size={12} /> Spend
                </div>
                <p className="font-bold text-foreground">${(card.spend / 1000).toFixed(1)}k</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 font-medium text-muted-foreground">
                <Activity size={12} /> Uptime
              </span>
              <span className={cn("font-bold", card.uptime < 99.9 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>{card.uptime.toFixed(2)}%</span>
            </div>
          </div>
        ))}
      </div>
    </Widget>
  );
}
