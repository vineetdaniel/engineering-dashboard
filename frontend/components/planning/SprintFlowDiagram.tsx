"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

interface Transition {
  from: string;
  to: string;
  count: number;
}

interface FlowData {
  sprint_name: string;
  type_counts: Record<string, number>;
  type_done: Record<string, number>;
  transitions: Transition[];
  avg_hours_per_status: Record<string, number>;
}

const TYPE_COLORS: Record<string, string> = {
  Story:    "bg-blue-500",
  Bug:      "bg-red-500",
  Task:     "bg-violet-500",
  Epic:     "bg-orange-500",
  "Sub-task": "bg-sky-400",
  Unknown:  "bg-gray-400",
};

const STATUS_ORDER = ["To Do", "In Progress", "In Review", "QA", "Done"];

function getColor(type: string) {
  return TYPE_COLORS[type] ?? "bg-gray-400";
}

function hoursLabel(h: number) {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

// Build ordered status columns from transitions
function buildColumns(transitions: Transition[]): string[] {
  const all = new Set<string>();
  transitions.forEach((t) => { all.add(t.from); all.add(t.to); });
  // Prefer known order, then append unknowns
  const ordered = STATUS_ORDER.filter((s) => all.has(s));
  all.forEach((s) => { if (!ordered.includes(s)) ordered.push(s); });
  return ordered;
}

export function SprintFlowDiagram({ jiraSprintId }: { jiraSprintId: number }) {
  const [data, setData] = useState<FlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noData, setNoData] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNoData(false);
    api(`/productivity/jira-sprint/${jiraSprintId}/flow`)
      .then((d: FlowData) => {
        const hasData = Object.keys(d.type_counts || {}).length > 0 || (d.transitions || []).length > 0;
        if (!hasData) setNoData(true);
        else setData(d);
      })
      .catch(() => setNoData(true))
      .finally(() => setLoading(false));
  }, [jiraSprintId]);

  if (loading) return <Card className="p-4 text-sm text-muted-foreground">Loading flow data…</Card>;
  if (noData) return (
    <Card className="p-4 text-sm text-muted-foreground">
      No flow data yet — sync Jira to fetch ticket type breakdown and changelog transitions.
    </Card>
  );
  if (!data) return null;

  const types = Object.entries(data.type_counts).sort((a, b) => b[1] - a[1]);
  const totalTickets = types.reduce((s, [, n]) => s + n, 0);

  const columns = buildColumns(data.transitions);
  // Build flow matrix: transitions[from][to] = count
  const matrix: Record<string, Record<string, number>> = {};
  data.transitions.forEach(({ from, to, count }) => {
    if (!matrix[from]) matrix[from] = {};
    matrix[from][to] = (matrix[from][to] || 0) + count;
  });

  // Max count for bar scaling
  const maxFlow = Math.max(...data.transitions.map((t) => t.count), 1);

  return (
    <div className="space-y-4">
      {/* Issue type breakdown */}
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Issue type breakdown</h2>
        <div className="flex flex-wrap gap-3">
          {types.map(([type, count]) => {
            const done = data.type_done[type] || 0;
            const pct = count > 0 ? Math.round((done / count) * 100) : 0;
            return (
              <div key={type} className="flex min-w-[120px] flex-col gap-1 rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-sm ${getColor(type)}`} />
                  <span className="text-xs font-medium">{type}</span>
                </div>
                <p className="text-2xl font-bold">{count}</p>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${getColor(type)} opacity-80`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground">{done} done · {pct}%</p>
              </div>
            );
          })}
          <div className="flex min-w-[120px] flex-col gap-1 rounded-lg border border-border bg-primary/5 p-3">
            <span className="text-xs font-medium text-muted-foreground">Total</span>
            <p className="text-2xl font-bold">{totalTickets}</p>
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary opacity-80"
                style={{ width: `${totalTickets > 0 ? Math.round(Object.values(data.type_done).reduce((s,n)=>s+n,0)/totalTickets*100) : 0}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {Object.values(data.type_done).reduce((s,n)=>s+n,0)} done
            </p>
          </div>
        </div>
      </Card>

      {/* Status flow diagram */}
      {data.transitions.length > 0 && (
        <Card className="p-4">
          <div className="mb-4">
            <h2 className="text-sm font-semibold">Status flow</h2>
            <p className="text-xs text-muted-foreground">Ticket transitions between columns — width = volume</p>
          </div>
          <div className="overflow-x-auto">
            <div className="flex min-w-[600px] gap-0">
              {columns.map((col, colIdx) => {
                const avgHrs = data.avg_hours_per_status[col];
                const inbound = data.transitions.filter(t => t.to === col).reduce((s,t) => s+t.count, 0);
                const outbound = Object.entries(matrix[col] || {});
                return (
                  <div key={col} className="flex flex-1 flex-col items-center">
                    {/* Column header */}
                    <div className="mb-3 w-full rounded-t-lg border border-border bg-muted/50 px-2 py-2 text-center">
                      <p className="text-xs font-semibold">{col}</p>
                      {avgHrs !== undefined && (
                        <p className="text-[10px] text-muted-foreground">avg {hoursLabel(avgHrs)}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground">{inbound} in</p>
                    </div>

                    {/* Flow arrows to next columns */}
                    <div className="w-full space-y-1 px-1">
                      {outbound
                        .sort((a, b) => b[1] - a[1])
                        .map(([to, cnt]) => {
                          const barW = Math.max(8, Math.round((cnt / maxFlow) * 100));
                          const isForward = columns.indexOf(to) > colIdx;
                          const isBack = columns.indexOf(to) < colIdx;
                          return (
                            <div key={to} className="group relative">
                              <div className="flex items-center gap-1">
                                <div
                                  className={`h-5 rounded text-[10px] font-medium text-white flex items-center justify-center transition-all ${isBack ? "bg-amber-500" : "bg-indigo-500"}`}
                                  style={{ width: `${barW}%`, minWidth: "2rem" }}
                                >
                                  {cnt}
                                </div>
                                <span className="text-[9px] text-muted-foreground truncate">→ {to}</span>
                              </div>
                              {isBack && (
                                <span className="text-[9px] text-amber-600 dark:text-amber-400">↩ back</span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Avg time per status summary */}
          {Object.keys(data.avg_hours_per_status).length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg time in each status</p>
              <div className="flex flex-wrap gap-3">
                {Object.entries(data.avg_hours_per_status)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, hrs]) => (
                    <div key={status} className="flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-1">
                      <span className="text-xs font-medium">{status}</span>
                      <span className="text-xs text-muted-foreground">{hoursLabel(hrs)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
