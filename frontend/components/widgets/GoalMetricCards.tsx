"use client";

import { Target, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GoalMetricCard } from "@/lib/api";

interface GoalMetricCardsProps {
  cards: GoalMetricCard[];
}

function statusVariant(status: string) {
  switch (status) {
    case "on_track":
      return "success";
    case "at_risk":
      return "warning";
    case "behind":
      return "danger";
    default:
      return "secondary";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "on_track":
      return "On track";
    case "at_risk":
      return "At risk";
    case "behind":
      return "Behind";
    default:
      return "No data";
  }
}

function progressColor(status: string) {
  switch (status) {
    case "on_track":
      return "bg-emerald-500";
    case "at_risk":
      return "bg-amber-500";
    case "behind":
      return "bg-rose-500";
    default:
      return "bg-muted-foreground/30";
  }
}

function formatMetric(value: number | null, metricType: string) {
  if (value == null) return "—";
  if (metricType === "uptime_pct" || metricType === "payment_success_rate") {
    return `${value.toFixed(2)}%`;
  }
  if (metricType === "change_failure_rate" || metricType === "fraud_rate") {
    return `${value.toFixed(2)}%`;
  }
  if (metricType === "compliance_control_status") {
    return `${(value * 100).toFixed(0)}%`;
  }
  return value.toLocaleString();
}

function formatTarget(value: number, metricType: string) {
  if (metricType === "uptime_pct" || metricType === "payment_success_rate") {
    return `${value.toFixed(2)}%`;
  }
  if (metricType === "change_failure_rate" || metricType === "fraud_rate") {
    return `${value.toFixed(2)}%`;
  }
  if (metricType === "compliance_control_status") {
    return `${(value * 100).toFixed(0)}%`;
  }
  return value.toLocaleString();
}

export function GoalMetricCards({ cards }: GoalMetricCardsProps) {
  if (!cards.length) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target size={18} className="text-primary" />
            <CardTitle>Goal-Metric Tracking</CardTitle>
          </div>
          <CardDescription>
            Fill in your strategic aims to see each one linked to a live metric, target, and RAG status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            No aims saved yet. Add your 6-month, quarterly, weekly, AI, risk, and growth aims to generate tracking cards.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-primary" />
            <CardTitle>Goal-Metric Tracking</CardTitle>
          </div>
          <Badge variant="outline">{cards.length} aims linked</Badge>
        </div>
        <CardDescription>
          Each strategic aim mapped to a proxy metric, target, and current RAG status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {cards.map((card) => (
          <div
            key={card.id}
            className={cn(
              "rounded-xl border border-border bg-card/50 p-4 transition hover:bg-card hover:shadow-sm",
              card.status === "behind" && "border-rose-200 dark:border-rose-900"
            )}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(card.status)}>{statusLabel(card.status)}</Badge>
                  <Badge variant="outline">{card.section}</Badge>
                  <span className="text-xs text-muted-foreground">Owner: {card.owner}</span>
                </div>
                <h4 className="text-sm font-semibold">{card.title}</h4>
                <p className="text-xs text-muted-foreground">{card.aim}</p>
              </div>

              <div className="shrink-0 text-right">
                <div className="flex items-center justify-end gap-2 text-sm">
                  <span className="font-semibold">{formatMetric(card.current, card.metric_type)}</span>
                  <span className="text-muted-foreground">/ {formatTarget(card.target_value, card.metric_type)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {card.metric_label} · {card.direction === "up" ? "↑ target" : "↓ target"}
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{card.progress != null ? `${card.progress.toFixed(0)}%` : "—"}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", progressColor(card.status))}
                  style={{ width: `${card.progress ?? 0}%` }}
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Target: {card.target}</span>
              <a
                href={`?section=${card.section}`}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                View section <ArrowRight size={12} />
              </a>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
