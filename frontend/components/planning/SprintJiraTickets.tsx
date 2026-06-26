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

interface JiraSprint {
  sprint_id: number;
  sprint_name: string;
  project: string;
}

interface JiraSprintDetail {
  jira_sprint_id: number;
  sprint_name: string;
  project: string;
  developers: {
    developer: string;
    account_id: string;
    total_sp: number;
    done_sp: number;
    done_count: number;
    open_issues: number;
  }[];
}

export function SprintJiraTickets({ sprintId, onJiraSprintChange }: { sprintId: number; onJiraSprintChange?: (id: number | null) => void }) {
  const [planRows, setPlanRows] = useState<JiraRow[]>([]);
  const [jiraSprints, setJiraSprints] = useState<JiraSprint[]>([]);
  const [selectedJiraSprint, setSelectedJiraSprint] = useState<number | null>(null);
  const [jiraDetail, setJiraDetail] = useState<JiraSprintDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [jiraLoading, setJiraLoading] = useState(false);

  // Load planning-matched data + Jira sprint list
  useEffect(() => {
    Promise.all([
      api(`/productivity/sprint-jira/${sprintId}`).catch(() => []),
      api("/productivity/jira-sprints").catch(() => []),
    ]).then(([plan, sprints]) => {
      setPlanRows(plan as JiraRow[]);
      setJiraSprints(sprints as JiraSprint[]);
    }).finally(() => setLoading(false));
  }, [sprintId]);

  // Load Jira sprint detail when selected
  useEffect(() => {
    if (selectedJiraSprint === null) { setJiraDetail(null); return; }
    setJiraLoading(true);
    api(`/productivity/jira-sprint/${selectedJiraSprint}`)
      .then((d) => setJiraDetail(d as JiraSprintDetail))
      .catch(() => setJiraDetail(null))
      .finally(() => setJiraLoading(false));
  }, [selectedJiraSprint]);

  if (loading) return <Card className="p-4 text-sm text-muted-foreground">Loading Jira data…</Card>;

  const showPlan = planRows.length > 0;
  const rows = jiraDetail ? jiraDetail.developers : null;

  const planTotal = planRows.reduce((acc, r) => ({
    open: acc.open + r.open_issues,
    done: acc.done + r.done_issues,
  }), { open: 0, done: 0 });

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Jira tickets</h2>
          {showPlan && (
            <p className="text-xs text-muted-foreground">
              {planTotal.open} open · {planTotal.done} done (resource-mapped)
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Jira sprint:</span>
          <select
            value={selectedJiraSprint ?? ""}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              setSelectedJiraSprint(val);
              onJiraSprintChange?.(val);
            }}
            className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
          >
            <option value="">— resource-mapped view —</option>
            {jiraSprints.map((s) => (
              <option key={s.sprint_id} value={s.sprint_id}>
                {s.sprint_name} ({s.project})
              </option>
            ))}
          </select>
        </div>
      </div>

      {jiraLoading && <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>}

      {/* Jira sprint direct view */}
      {!jiraLoading && rows && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] text-sm">
            <thead className="bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Developer</th>
                <th className="px-4 py-2 text-right">Total SP</th>
                <th className="px-4 py-2 text-right">Done SP</th>
                <th className="px-4 py-2 text-right">Done tickets</th>
                <th className="px-4 py-2 text-right">Open tickets</th>
                <th className="px-4 py-2 text-right">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const total = r.done_count + r.open_issues;
                const pct = total > 0 ? Math.round((r.done_count / total) * 100) : 0;
                return (
                  <tr key={r.developer} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{r.developer}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{r.total_sp || "—"}</td>
                    <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400">{r.done_sp || "—"}</td>
                    <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400">{r.done_count || "—"}</td>
                    <td className="px-4 py-2 text-right">
                      {r.open_issues > 0
                        ? <span className="font-medium text-amber-600 dark:text-amber-400">{r.open_issues}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
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
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right text-muted-foreground">{rows.reduce((s, r) => s + r.total_sp, 0).toFixed(0)}</td>
                <td className="px-4 py-2 text-right text-emerald-600">{rows.reduce((s, r) => s + r.done_sp, 0).toFixed(0)}</td>
                <td className="px-4 py-2 text-right text-emerald-600">{rows.reduce((s, r) => s + r.done_count, 0)}</td>
                <td className="px-4 py-2 text-right text-amber-600">{rows.reduce((s, r) => s + r.open_issues, 0)}</td>
                <td className="px-4 py-2 text-right text-muted-foreground">
                  {(() => { const t = rows.reduce((s,r) => s + r.done_count + r.open_issues, 0); const d = rows.reduce((s,r) => s + r.done_count, 0); return t > 0 ? `${Math.round(d/t*100)}%` : "—"; })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Resource-mapped view (default) */}
      {!jiraLoading && !rows && showPlan && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] text-sm">
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
              {planRows.map((r) => {
                const total = r.open_issues + r.done_issues;
                const pct = total > 0 ? Math.round((r.done_issues / total) * 100) : 0;
                return (
                  <tr key={r.developer} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{r.developer}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.team}</td>
                    <td className="px-4 py-2 text-right">
                      {r.open_issues > 0
                        ? <span className="font-medium text-amber-600 dark:text-amber-400">{r.open_issues}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {r.done_issues > 0
                        ? <span className="text-emerald-600 dark:text-emerald-400">{r.done_issues}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{r.alloc_sp}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
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
                <td className="px-4 py-2 text-right text-amber-600">{planTotal.open}</td>
                <td className="px-4 py-2 text-right text-emerald-600">{planTotal.done}</td>
                <td className="px-4 py-2 text-right text-muted-foreground">{planRows.reduce((s,r) => s + r.alloc_sp, 0)}</td>
                <td className="px-4 py-2 text-right text-muted-foreground">
                  {planTotal.open + planTotal.done > 0 ? `${Math.round(planTotal.done / (planTotal.open + planTotal.done) * 100)}%` : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!jiraLoading && !rows && !showPlan && (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          No Jira mapping yet — edit resources and set their Jira account, or pick a Jira sprint from the dropdown above.
        </p>
      )}
    </Card>
  );
}
