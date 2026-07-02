"use client";

import { Card } from "@/components/ui/card";
import type { Allocation } from "@/lib/actions/sprints";

interface SummaryCardsProps {
  allocations: Allocation[];
}

export function SummaryCards({ allocations }: SummaryCardsProps) {
  const byTeam = allocations.reduce<Record<string, { count: number; storyPoints: number; effectiveHours: number }>>(
    (acc, a) => {
      const current = acc[a.team] || { count: 0, storyPoints: 0, effectiveHours: 0 };
      current.count += 1;
      current.storyPoints += Number(a.story_points) || 0;
      current.effectiveHours += Number(a.effective_hours) || 0;
      acc[a.team] = current;
      return acc;
    },
    {}
  );

  const totalStoryPoints = Object.values(byTeam).reduce((sum, t) => sum + t.storyPoints, 0);
  const totalEffectiveHours = Object.values(byTeam).reduce((sum, t) => sum + t.effectiveHours, 0);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <Card className="p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total story points</p>
        <p className="mt-1 text-2xl font-bold">{totalStoryPoints}</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total effective hours</p>
        <p className="mt-1 text-2xl font-bold">{totalEffectiveHours.toFixed(1)}</p>
      </Card>
      {Object.entries(byTeam).map(([team, stats]) => (
        <Card key={team} className="p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{team}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold">{stats.storyPoints}</span>
            <span className="text-sm text-muted-foreground">SP</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.count} resources · {stats.effectiveHours.toFixed(0)} eff hrs
          </p>
        </Card>
      ))}
    </div>
  );
}
