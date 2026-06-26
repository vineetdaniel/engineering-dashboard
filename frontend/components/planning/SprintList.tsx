"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { SprintListItem, SprintStatus } from "@/lib/actions/sprints";

interface SprintListProps {
  sprints: SprintListItem[];
}

const statusVariant: Record<SprintStatus, "default" | "success" | "warning" | "secondary"> = {
  planning: "secondary",
  active: "success",
  completed: "warning",
};

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function SprintList({ sprints }: SprintListProps) {
  if (sprints.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border bg-card">
        <p className="text-sm text-muted-foreground">No sprints yet. Create one to get started.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3">Sprint</th>
            <th className="px-4 py-3">Dates</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Resources</th>
            <th className="px-4 py-3 text-right">Story points</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sprints.map((s) => (
            <tr key={s.id} className="transition-colors hover:bg-muted/30">
              <td className="px-4 py-3">
                <Link
                  href={`/sprints/${s.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {s.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDate(s.start_date)} – {formatDate(s.end_date)}
              </td>
              <td className="px-4 py-3">
                <Badge variant={statusVariant[s.status]}>{s.status}</Badge>
              </td>
              <td className="px-4 py-3 text-right">{s.resource_count}</td>
              <td className="px-4 py-3 text-right font-semibold">{s.total_story_points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
