"use client";

import { HeartPulse, Activity, GitPullRequest, CreditCard, Wallet, Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HealthScore } from "@/lib/api";

interface StrategyHealthScoreProps {
  healthScore: HealthScore;
}

const DIMENSIONS: { key: string; label: string; icon: React.ElementType; description: string }[] = [
  { key: "operational", label: "Operational", icon: Activity, description: "Incidents, CVEs, uptime" },
  { key: "delivery", label: "Delivery", icon: GitPullRequest, description: "PRs, bugs, blocked tickets" },
  { key: "payments", label: "Payments", icon: CreditCard, description: "Success rate, fraud" },
  { key: "cost", label: "Cost", icon: Wallet, description: "Cloud spend vs budget" },
  { key: "goals", label: "Goal Clarity", icon: Target, description: "Aims defined" },
];

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-amber-500";
  if (score >= 40) return "text-rose-500";
  return "text-red-600";
}

function scoreBadgeVariant(score: number) {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  if (score >= 40) return "danger";
  return "danger";
}

function scoreBarColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  if (score >= 40) return "bg-rose-500";
  return "bg-red-600";
}

export function StrategyHealthScore({ healthScore }: StrategyHealthScoreProps) {
  const { score, label, dimensions } = healthScore;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HeartPulse size={18} className="text-primary" />
            <CardTitle>Strategy Health Score</CardTitle>
          </div>
          <Badge variant={scoreBadgeVariant(score)} className="capitalize">
            {label}
          </Badge>
        </div>
        <CardDescription>
          Composite score across ops, delivery, payments, cost, and goal clarity.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-end gap-3">
          <span className={cn("text-5xl font-bold leading-none", scoreColor(score))}>
            {score.toFixed(1)}
          </span>
          <span className="mb-1 text-sm text-muted-foreground">/ 100</span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Overall health</span>
            <span className="font-medium capitalize">{label}</span>
          </div>
          <Progress value={score} className="h-2" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {DIMENSIONS.map(({ key, label, icon: Icon, description }) => {
            const dim = dimensions[key];
            if (!dim) return null;
            return (
              <div key={key} className="rounded-xl border border-border bg-card/50 p-3 transition hover:bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className="text-muted-foreground" />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <span className={cn("text-sm font-semibold", scoreColor(dim.score))}>
                    {dim.score.toFixed(1)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", scoreBarColor(dim.score))}
                    style={{ width: `${dim.score}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
