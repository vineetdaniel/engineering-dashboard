"use client";

import { useId } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts";
import { CheckCircle, AlertTriangle, ArrowRight } from "lucide-react";
import type { DeveloperPersona } from "@/lib/persona";

interface PersonaCardProps {
  persona: DeveloperPersona;
}

export function PersonaCard({ persona: p }: PersonaCardProps) {
  const radarGradId = useId().replace(/:/g, "");
  const s = p.signal;
  const slug = encodeURIComponent(s.name.toLowerCase().replace(/\s+/g, "-"));

  const radarData = [
    { axis: "Delivery",      value: p.scores.delivery },
    { axis: "Activity",      value: p.scores.activity },
    { axis: "Quality",       value: p.scores.quality },
    { axis: "Collab",        value: p.scores.collaboration },
    { axis: "Breadth",       value: p.scores.breadth },
    { axis: "Consistency",   value: p.scores.consistency },
  ];

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      {/* Gradient header */}
      <div className={`bg-gradient-to-r ${p.color} p-4`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{p.icon}</span>
            <div>
              <h3 className="text-base font-bold leading-tight text-white drop-shadow-sm">{s.name}</h3>
              <p className="text-xs text-white/80">{s.team} · {s.role}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="rounded-full bg-black/20 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
              {p.type}
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs text-white/90 italic">{p.tagline}</p>
      </div>

      {/* Radar + key stats */}
      <div className="p-4">
        <div className="flex gap-4">
          {/* Radar — omit for no-data Emerging cards */}
          {!(p.type === "Emerging" && s.commits === 0 && s.prs_authored === 0) && (
            <div className="h-36 w-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                  <PolarGrid stroke="currentColor" className="text-muted-foreground/25" />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={{ fontSize: 8, fill: "currentColor" }}
                    className="text-muted-foreground"
                  />
                  <Radar
                    dataKey="value"
                    stroke={`url(#${radarGradId})`}
                    fill={`url(#${radarGradId})`}
                    fillOpacity={0.45}
                    strokeWidth={2}
                  />
                  <defs>
                    <linearGradient id={radarGradId} x1="0" y1="0" x2="1" y2="1">
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
          )}

          {/* Key numbers */}
          {p.type === "Emerging" && s.commits === 0 && s.prs_authored === 0 && s.total_tickets_done === 0 ? (
            <div className="flex-1 flex items-center justify-center min-h-36">
              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                No GitHub or Jira data yet.<br />
                Map GitHub handle &amp; Jira account<br />in Resources, then sync.
              </p>
            </div>
          ) : p.type === "Emerging" && s.commits === 0 && s.prs_authored === 0 ? (
            <div className="flex-1 flex items-center justify-center min-h-36">
              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                GitHub data missing — map handle<br />in Resources, then sync.
                <br />
                <span className="text-[10px] text-muted-foreground/70">Jira signals are present.</span>
              </p>
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <Stat label="Delivery rate" value={s.delivery_rate_pct !== null ? `${s.delivery_rate_pct}%` : "—"} good={s.delivery_rate_pct !== null && s.delivery_rate_pct >= 80} />
              <Stat label="Quality" value={p.scores.quality} />
              <Stat label="Commits" value={s.commits} />
              <Stat label="Open tickets" value={s.open_issues} warn={s.open_issues > 50} />
              <Stat label="PRs authored" value={s.prs_authored} />
              <Stat label="Open PRs" value={s.open_prs} warn={s.open_prs >= 4} />
            </div>
          )}
        </div>

        {/* Strengths / risks */}
        {p.strengths.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {p.strengths.slice(0, 3).map((str) => (
              <span key={str} className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                <CheckCircle size={9} /> {str}
              </span>
            ))}
          </div>
        )}
        {p.risks.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {p.risks.slice(0, 2).map((r) => (
              <span key={r} className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                <AlertTriangle size={9} /> {r}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Link to full profile */}
      <Link
        href={`/personas/${slug}`}
        className="flex items-center justify-center gap-1 border-t border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
      >
        View profile <ArrowRight size={12} />
      </Link>
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
