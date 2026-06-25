"use client";

import { CheckCircle2, Clock, AlertCircle, User } from "lucide-react";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface PostIncidentActionsProps {
  events: any[];
  className?: string;
}

const ACTION_ITEMS = [
  { id: 1, title: "Add circuit breaker to payments-core fallback", owner: "Priya", due: "2d", status: "open", severity: "high" },
  { id: 2, title: "Increase ledger replica lag alert threshold", owner: "Jordan", due: "5d", status: "open", severity: "medium" },
  { id: 3, title: "Document auth-service retry policy", owner: "Sam", due: "1d", status: "open", severity: "high" },
  { id: 4, title: "Review webhook-router rate limits", owner: "Alex", due: "7d", status: "open", severity: "low" },
];

export function PostIncidentActions({ className }: PostIncidentActionsProps) {
  const total = ACTION_ITEMS.length;
  const overdue = ACTION_ITEMS.filter((a) => a.due === "1d").length;
  const open = ACTION_ITEMS.filter((a) => a.status === "open").length;
  const closed = total - open;
  const completion = Math.round((closed / total) * 100);

  return (
    <Widget className={className}>
      <WidgetHeader
        title="Post-Incident Actions"
        subtitle={`${open} open · ${overdue} overdue`}
        action={
          overdue > 0 && (
            <Badge
              variant="outline"
              className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
            >
              <AlertCircle size={12} className="mr-1" /> {overdue} overdue
            </Badge>
          )
        }
      />

      <div className="mb-4 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Completion</span>
        <span className="font-medium">{completion}%</span>
      </div>
      <Progress value={completion} className="mb-4 h-2" />

      <div className="space-y-2">
        {ACTION_ITEMS.map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-3 transition hover:bg-muted/40"
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  item.status === "closed"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                )}
              >
                {item.status === "closed" ? <CheckCircle2 size={14} /> : <Clock size={14} />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User size={12} /> {item.owner}
                  </span>
                  <span>Due {item.due}</span>
                </div>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 text-[10px]",
                item.severity === "high"
                  ? "border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300"
                  : item.severity === "medium"
                  ? "border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-300"
                  : "border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-300"
              )}
            >
              {item.severity}
            </Badge>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" className="mt-3 w-full">
        View all action items
      </Button>
    </Widget>
  );
}
