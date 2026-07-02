"use client";

import { Card } from "@/components/ui/card";
import type { DeveloperProductivity } from "@/lib/api";

interface WorkloadHeatmapProps {
  developers: DeveloperProductivity[];
}

function riskScore(d: DeveloperProductivity): number {
  // High open issues + high SP + low commits = at risk
  const issueScore = Math.min(d.jira_open_issues / 30, 1); // normalize to ~30 open
  const spScore = Math.min(d.allocated_story_points / 200, 1); // normalize to ~200 SP
  const commitScore = d.commits > 0 ? 1 - Math.min(d.commits / 50, 1) : 1; // low commits = risk
  return Math.round((issueScore * 0.5 + spScore * 0.3 + commitScore * 0.2) * 100);
}

function riskColor(score: number): string {
  if (score >= 70) return "bg-red-500";
  if (score >= 45) return "bg-amber-400";
  if (score >= 20) return "bg-yellow-300 dark:bg-yellow-500";
  return "bg-emerald-400";
}

function riskLabel(score: number): string {
  if (score >= 70) return "High";
  if (score >= 45) return "Medium";
  if (score >= 20) return "Low";
  return "Clear";
}

export function WorkloadHeatmap({ developers }: WorkloadHeatmapProps) {
  const active = developers
    .filter((d) => d.allocated_story_points > 0 || d.jira_open_issues > 0 || d.commits > 0)
    .map((d) => ({ ...d, risk: riskScore(d) }))
    .sort((a, b) => b.risk - a.risk);

  if (active.length === 0) return null;

  const teams = [...new Set(active.map((d) => d.team || "Unassigned"))].sort();

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Workload risk</h2>
          <p className="text-xs text-muted-foreground">Open Jira tickets × allocated SP × commit activity</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {[["bg-emerald-400", "Clear"], ["bg-yellow-300 dark:bg-yellow-500", "Low"], ["bg-amber-400", "Med"], ["bg-red-500", "High"]].map(([cls, lbl]) => (
            <span key={lbl} className="flex items-center gap-1">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${cls}`} />
              {lbl}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        {teams.map((team) => {
          const members = active.filter((d) => (d.team || "Unassigned") === team);
          if (!members.length) return null;
          return (
            <div key={team}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{team}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {members.map((d) => (
                  <div
                    key={d.name}
                    className="group relative rounded-lg border border-border bg-card p-3 transition-shadow hover:shadow-md"
                  >
                    {/* Risk bar across top */}
                    <div className={`absolute inset-x-0 top-0 h-1 rounded-t-lg ${riskColor(d.risk)}`} />
                    <div className="mt-1 flex items-start justify-between gap-1">
                      <p className="truncate text-sm font-medium leading-tight">{d.name.split(" ")[0]}</p>
                      <span className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold text-white ${riskColor(d.risk)}`}>
                        {riskLabel(d.risk)}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Open</p>
                        <p className={`text-sm font-bold ${d.jira_open_issues > 30 ? "text-red-500" : "text-foreground"}`}>
                          {d.jira_open_issues}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">SP</p>
                        <p className="text-sm font-bold">{d.allocated_story_points}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Commits</p>
                        <p className={`text-sm font-bold ${d.commits === 0 ? "text-amber-500" : "text-foreground"}`}>
                          {d.commits}
                        </p>
                      </div>
                    </div>
                    {/* Lines of code if available */}
                    {(d.lines_added > 0 || d.lines_deleted > 0) && (
                      <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                        <span className="text-emerald-600">+{d.lines_added.toLocaleString()}</span>
                        {" / "}
                        <span className="text-red-500">-{d.lines_deleted.toLocaleString()}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
