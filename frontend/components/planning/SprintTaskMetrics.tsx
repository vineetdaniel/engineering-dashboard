"use client";

import { Card } from "@/components/ui/card";
import type { Allocation } from "@/lib/actions/sprints";

interface SprintTaskMetricsProps {
  allocations: Allocation[];
}

/**
 * Sprint-plan metrics derived from tasks (distinct from the capacity metrics
 * in SummaryCards). Surfaces UAT schedule and task throughput at a glance.
 */
export function SprintTaskMetrics({ allocations }: SprintTaskMetricsProps) {
  const tasks = allocations.flatMap((a) => a.tasks);
  if (tasks.length === 0) return null;

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const withUat = tasks.filter((t) => t.uat_date).length;

  const byCategory = tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + 1;
    return acc;
  }, {});

  // Next UAT date across all tasks (earliest upcoming-or-any).
  const uatDates = tasks
    .map((t) => t.uat_date)
    .filter((d): d is string => !!d)
    .sort();
  const nextUat = uatDates[0] ?? null;

  const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <Card className="p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tasks</p>
        <p className="mt-1 text-2xl font-bold">{total}</p>
        <p className="text-xs text-muted-foreground">{inProgress} in progress</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Completion</p>
        <p className="mt-1 text-2xl font-bold">{completionPct}%</p>
        <p className="text-xs text-muted-foreground">{done} of {total} done</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">UAT scheduled</p>
        <p className="mt-1 text-2xl font-bold">{withUat}</p>
        <p className="text-xs text-muted-foreground">
          {nextUat ? `next ${nextUat}` : "none set"}
        </p>
      </Card>
      <Card className="p-4 col-span-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Category mix</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {Object.entries(byCategory).map(([cat, count]) => (
            <span key={cat}>
              <span className="font-bold">{count}</span>{" "}
              <span className="text-muted-foreground">{cat}</span>
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
