"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { GitBranch, Users } from "lucide-react";
import type { Resource } from "@/lib/actions/resources";

const ROLE_COLORS: Record<string, string> = {
  developer: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  qa: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  devops: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  designer: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  pm: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
};

export function TeamRoster() {
  const [grouped, setGrouped] = useState<Record<string, Resource[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/planning/resources")
      .then((r) => r.json())
      .then((data: Resource[]) => {
        const active = data.filter((r) => r.is_active);
        const g: Record<string, Resource[]> = {};
        for (const r of active) {
          g[r.team] = g[r.team] || [];
          g[r.team].push(r);
        }
        setGrouped(g);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalActive = Object.values(grouped).flat().length;
  const teams = Object.keys(grouped).sort();

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <Users size={16} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold">Engineering Roster</h2>
        {!loading && (
          <span className="ml-auto text-xs text-muted-foreground">{totalActive} active</span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : teams.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No resources yet. Add them in{" "}
          <a href="/resources" className="underline">
            Resource Manager
          </a>
          .
        </p>
      ) : (
        <div className="space-y-5">
          {teams.map((team) => (
            <div key={team}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {team} ({grouped[team].length})
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {grouped[team].map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {r.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      {r.github_handle && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <GitBranch size={10} />
                          {r.github_handle}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${ROLE_COLORS[r.role] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {r.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
