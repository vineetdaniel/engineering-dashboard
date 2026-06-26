"use client";

import { Card } from "@/components/ui/card";
import type { Resource } from "@/lib/actions/resources";

interface ResourceTeamSummaryProps {
  resources: Resource[];
}

/**
 * Resource-manager metrics: headcount and default capacity per team across
 * active resources. This is the Resource Allocation side's own summary,
 * separate from the per-sprint allocation metrics on the sprint detail page.
 */
export function ResourceTeamSummary({ resources }: ResourceTeamSummaryProps) {
  const active = resources.filter((r) => r.is_active);
  if (active.length === 0) return null;

  const byTeam = active.reduce<Record<string, { count: number; hours: number }>>((acc, r) => {
    const cur = acc[r.team] || { count: 0, hours: 0 };
    cur.count += 1;
    cur.hours += Number(r.default_hours_per_sprint) || 0;
    acc[r.team] = cur;
    return acc;
  }, {});

  const totalHours = Object.values(byTeam).reduce((s, t) => s + t.hours, 0);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <Card className="p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active resources</p>
        <p className="mt-1 text-2xl font-bold">{active.length}</p>
        <p className="text-xs text-muted-foreground">{Object.keys(byTeam).length} teams</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Default capacity</p>
        <p className="mt-1 text-2xl font-bold">{totalHours.toFixed(0)}</p>
        <p className="text-xs text-muted-foreground">hrs / sprint</p>
      </Card>
      {Object.entries(byTeam).map(([team, stats]) => (
        <Card key={team} className="p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{team}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold">{stats.count}</span>
            <span className="text-sm text-muted-foreground">ppl</span>
          </div>
          <p className="text-xs text-muted-foreground">{stats.hours.toFixed(0)} hrs / sprint</p>
        </Card>
      ))}
    </div>
  );
}
