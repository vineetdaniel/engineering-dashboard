"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

interface JiraRow {
  developer: string;
  team: string;
  open_issues: number;
  done_issues: number;
  open_sp: number;
  done_sp: number;
  alloc_sp: number;
  effective_hours: number;
}

export function SprintJiraTickets({ sprintId }: { sprintId: number }) {
  const [rows, setRows] = useState<JiraRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api(`/productivity/sprint-jira/${sprintId}`)
      .then((data: JiraRow[]) => setRows(data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sprintId]);

  const total = rows.reduce(
    (acc, r) => ({
      open: acc.open + r.open_issues,
      done: acc.done + r.done_issues,
      alloc: acc.alloc + r.alloc_sp,
    }),
    { open: 0, done: 0, alloc: 0 }
  );

  if (loading) return <Card className="p-4 text-sm text-muted-foreground">Loading Jira data…</Card>;
  if (error) return null;
  if (rows.length === 0)
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        No Jira mapping yet — edit resources and set their Jira account to see ticket data here.
      </Card>
    );

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Jira tickets</h2>
          <p className="text-xs text-muted-foreground">
            {total.open} open · {total.done} done · {total.alloc} SP allocated
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Developer</th>
              <th className="px-4 py-2">Team</th>
              <th className="px-4 py-2 text-right">Open</th>
              <th className="px-4 py-2 text-right">Done</th>
              <th className="px-4 py-2 text-right">Alloc SP</th>
              <th className="px-4 py-2 text-right">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const total_issues = r.open_issues + r.done_issues;
              const pct = total_issues > 0 ? Math.round((r.done_issues / total_issues) * 100) : 0;
              return (
                <tr key={r.developer} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{r.developer}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.team}</td>
                  <td className="px-4 py-2 text-right">
                    {r.open_issues > 0 ? (
                      <span className="font-medium text-amber-600 dark:text-amber-400">{r.open_issues}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.done_issues > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">{r.done_issues}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{r.alloc_sp}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-xs text-muted-foreground">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-border bg-muted/30 text-xs font-semibold">
            <tr>
              <td className="px-4 py-2" colSpan={2}>Total</td>
              <td className="px-4 py-2 text-right text-amber-600 dark:text-amber-400">{total.open}</td>
              <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400">{total.done}</td>
              <td className="px-4 py-2 text-right text-muted-foreground">{total.alloc}</td>
              <td className="px-4 py-2 text-right text-muted-foreground">
                {total.open + total.done > 0
                  ? `${Math.round((total.done / (total.open + total.done)) * 100)}%`
                  : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
