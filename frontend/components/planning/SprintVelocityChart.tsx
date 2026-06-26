"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { getSprintVelocity, type SprintVelocityData } from "@/lib/api";

const TEAM_COLORS: Record<string, string> = {
  Backend: "#6366f1",
  FrontEnd: "#0ea5e9",
  "Payme App": "#10b981",
  DevOps: "#f59e0b",
  QA: "#f43f5e",
};
const FALLBACK_COLORS = ["#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16"];

function colorFor(team: string, idx: number) {
  return TEAM_COLORS[team] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

export function SprintVelocityChart() {
  const [data, setData] = useState<SprintVelocityData | null>(null);
  const [view, setView] = useState<"team" | "developer">("team");

  useEffect(() => {
    getSprintVelocity().then(setData).catch(() => {});
  }, []);

  if (!data || data.sprints.length === 0) return null;

  const sprintLabels = data.sprints.map((s) => ({
    id: s.id,
    label: (s.name || "").replace(/Sprint-?/i, "").slice(0, 18),
  }));

  if (view === "team") {
    // Aggregate by team per sprint
    const teams = [...new Set(data.developers.map((d) => d.team || "Other"))].sort();
    const chartData = sprintLabels.map(({ id, label }) => {
      const point: Record<string, string | number> = { sprint: label };
      teams.forEach((team) => {
        point[team] = data.developers
          .filter((d) => (d.team || "Other") === team)
          .reduce((sum, d) => sum + (d.sprints[id]?.sp ?? 0), 0);
      });
      return point;
    });
    return (
      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Sprint velocity</h2>
            <p className="text-xs text-muted-foreground">Allocated story points per sprint</p>
          </div>
          <div className="flex gap-1">
            {(["team", "developer"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} barSize={28}>
            <XAxis dataKey="sprint" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {teams.map((team, i) => (
              <Bar key={team} dataKey={team} stackId="a" fill={colorFor(team, i)} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Card>
    );
  }

  // Developer view — grouped bars, one per developer across sprints
  const chartData = data.developers
    .filter((d) => Object.values(d.sprints).some((s) => s.sp > 0))
    .map((d) => {
      const point: Record<string, string | number> = { name: d.name.split(" ")[0] };
      data.sprints.forEach((s) => { point[`S${s.id}`] = d.sprints[s.id]?.sp ?? 0; });
      return point;
    });

  const sprintKeys = data.sprints.map((s) => `S${s.id}`);
  const sprintBarColors = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b"];

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Sprint velocity</h2>
          <p className="text-xs text-muted-foreground">Allocated SP per developer across sprints</p>
        </div>
        <div className="flex gap-1">
          {(["team", "developer"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} barSize={12}>
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={40} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend formatter={(v) => {
            const idx = sprintKeys.indexOf(v);
            return sprintLabels[idx]?.label ?? v;
          }} />
          {sprintKeys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={sprintBarColors[i % sprintBarColors.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
