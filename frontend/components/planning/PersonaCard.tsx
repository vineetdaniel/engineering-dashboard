"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts";
import { GitBranch, CheckCircle, AlertTriangle, Clock, Star } from "lucide-react";
import type { DeveloperPersona } from "@/lib/persona";
import { peakHourLabel, peakDowLabel } from "@/lib/persona";

interface PersonaCardProps {
  persona: DeveloperPersona;
}

export function PersonaCard({ persona: p }: PersonaCardProps) {
  const [expanded, setExpanded] = useState(false);
  const s = p.signal;

  const radarData = [
    { axis: "Delivery",      value: p.scores.delivery },
    { axis: "Activity",      value: p.scores.activity },
    { axis: "Quality",       value: p.scores.quality },
    { axis: "Collab",        value: p.scores.collaboration },
    { axis: "Breadth",       value: p.scores.breadth },
    { axis: "Consistency",   value: p.scores.consistency },
  ];

  return (
    <Card
      className="overflow-hidden cursor-pointer transition-shadow hover:shadow-lg"
      onClick={() => setExpanded((e) => !e)}
    >
      {/* Gradient header */}
      <div className={`bg-gradient-to-r ${p.color} p-4 text-white`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{p.icon}</span>
            <div>
              <h3 className="text-base font-bold leading-tight">{s.name}</h3>
              <p className="text-xs opacity-80">{s.team} · {s.role}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold backdrop-blur-sm">
              {p.type}
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs opacity-90 italic">{p.tagline}</p>
      </div>

      {/* Radar + key stats */}
      <div className="p-4">
        <div className="flex gap-4">
          {/* Radar */}
          <div className="h-36 w-36 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <PolarGrid stroke="currentColor" className="text-muted-foreground/20" />
                <PolarAngleAxis
                  dataKey="axis"
                  tick={{ fontSize: 8, fill: "currentColor" }}
                  className="text-muted-foreground"
                />
                <Radar
                  dataKey="value"
                  stroke="url(#radar-grad)"
                  fill="url(#radar-grad)"
                  fillOpacity={0.35}
                  strokeWidth={1.5}
                />
                <defs>
                  <linearGradient id="radar-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{ fontSize: 10, padding: "4px 8px" }}
                  formatter={(v: number) => [`${v}/100`]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Key numbers */}
          <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <Stat label="Commits" value={s.commits} />
            <Stat label="PRs authored" value={s.prs_authored} />
            <Stat label="PRs reviewed" value={s.prs_reviewed} />
            <Stat label="Open tickets" value={s.open_issues} warn={s.open_issues > 50} />
            <Stat label="Delivery rate" value={s.delivery_rate_pct !== null ? `${s.delivery_rate_pct}%` : "—"} good={s.delivery_rate_pct !== null && s.delivery_rate_pct >= 80} />
            <Stat label="Concern ratio" value={`${s.concern_ratio_pct}%`} warn={s.concern_ratio_pct > 15} />
          </div>
        </div>

        {/* Strengths / risks always visible */}
        {p.strengths.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {p.strengths.map((str) => (
              <span key={str} className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                <CheckCircle size={9} /> {str}
              </span>
            ))}
          </div>
        )}
        {p.risks.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {p.risks.map((r) => (
              <span key={r} className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                <AlertTriangle size={9} /> {r}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
            <DetailBlock label="Peak time" value={`${peakHourLabel(s.peak_hour_ist)} ${peakDowLabel(s.peak_dow)}`} icon={<Clock size={11} />} />
            <DetailBlock label="After hours" value={`${s.after_hours_pct}% commits`} warn={s.after_hours_pct > 25} icon={<Clock size={11} />} />
            <DetailBlock label="Weekends" value={`${s.weekend_pct}%`} warn={s.weekend_pct > 10} icon={<Clock size={11} />} />
            <DetailBlock label="Repos" value={s.repos_touched} icon={<GitBranch size={11} />} />
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
            <DetailBlock label="+Lines" value={s.lines_added.toLocaleString()} />
            <DetailBlock label="−Lines" value={s.lines_deleted.toLocaleString()} />
            <DetailBlock label="Avg merge" value={s.avg_merge_hours !== null ? `${Math.round(s.avg_merge_hours)}h` : "—"} warn={(s.avg_merge_hours ?? 0) > 48} />
            <DetailBlock label="PRs gated" value={s.prs_gated} icon={<Star size={11} />} />
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
            <DetailBlock label="Sprints" value={s.sprints_participated} />
            <DetailBlock label="SP committed" value={s.total_sp_committed} />
            <DetailBlock label="SP delivered" value={s.total_sp_delivered} />
            <DetailBlock label="Tickets done" value={s.total_tickets_done} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <DetailBlock label="Feature PRs" value={s.feature_prs} />
            <DetailBlock label="Fix PRs" value={s.fix_prs} />
            <DetailBlock label="Refactor PRs" value={s.refactor_prs} />
          </div>
          {/* Score bars */}
          <div className="space-y-1.5">
            {Object.entries(p.scores).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-20 text-[10px] capitalize text-muted-foreground">{key}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${val}%` }}
                  />
                </div>
                <span className="w-7 text-right text-[10px] text-muted-foreground">{val}</span>
              </div>
            ))}
          </div>
          {s.github_handle && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <GitBranch size={9} /> {s.github_handle}
            </p>
          )}
        </div>
      )}

      <div className="border-t border-border px-4 py-1.5 text-center text-[10px] text-muted-foreground">
        {expanded ? "Click to collapse" : "Click to expand"}
      </div>
    </Card>
  );
}

function Stat({ label, value, warn, good }: { label: string; value: string | number; warn?: boolean; good?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={`font-semibold ${warn ? "text-amber-600 dark:text-amber-400" : good ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function DetailBlock({ label, value, warn, icon }: { label: string; value: string | number; warn?: boolean; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-muted-foreground">{icon}{label}</p>
      <p className={`font-medium ${warn ? "text-amber-600 dark:text-amber-400" : ""}`}>{value}</p>
    </div>
  );
}
