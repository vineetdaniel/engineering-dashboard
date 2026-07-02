"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlanningSubNav } from "./PlanningSubNav";
import { ArrowLeft, CheckCircle, AlertTriangle, Clock, Users, FolderGit, FileCode, Wrench, Zap, MessageSquare, BarChart3, Quote } from "lucide-react";
import { getDeveloperSignal, type DeveloperSignal } from "@/lib/api";
import { buildPersonas, peakHourLabel, peakDowLabel } from "@/lib/persona";
import { projectManagerFeedback, productManagerFeedback, ctoFeedback } from "@/lib/personaFeedback";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

interface PersonaDetailClientProps {
  name: string;
}

export function PersonaDetailClient({ name }: PersonaDetailClientProps) {
  const radarGradId = useId().replace(/:/g, "");
  const [signal, setSignal] = useState<DeveloperSignal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDeveloperSignal(name)
      .then((s) => {
        if (cancelled) return;
        setSignal(s);
      })
      .catch((err) => {
        if (cancelled) return;
        setSignal(null);
        setError(err instanceof Error ? err.message : "Failed to load profile");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [name]);

  if (loading) {
    return <PersonaDetailSkeleton />;
  }

  if (error || !signal) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PlanningSubNav active="personas" />
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {error || "Developer not found."}
          <div className="mt-4">
            <Link href="/personas">
              <Button variant="outline" size="sm">
                <ArrowLeft size={14} className="mr-1" /> Back to personas
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const [persona] = buildPersonas([signal]);
  const s = persona.signal;
  const p = persona;

  const radarData = [
    { axis: "Delivery", value: p.scores.delivery },
    { axis: "Activity", value: p.scores.activity },
    { axis: "Quality", value: p.scores.quality },
    { axis: "Collab", value: p.scores.collaboration },
    { axis: "Breadth", value: p.scores.breadth },
    { axis: "Consistency", value: p.scores.consistency },
  ];

  const reviewMixData = [
    { name: "Approvals", value: s.approvals_given, fill: "#22c55e" },
    { name: "Changes requested", value: s.changes_requested_given, fill: "#f59e0b" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PlanningSubNav active="personas" />

      <div className="flex items-center justify-between">
        <Link href="/personas">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <ArrowLeft size={14} className="mr-1" /> Back to personas
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className={`bg-gradient-to-r ${p.color} rounded-2xl p-6 text-white`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-5xl">{p.icon}</span>
            <div>
              <h1 className="text-2xl font-bold drop-shadow-sm">{s.name}</h1>
              <p className="text-sm text-white/80">{s.team} · {s.role}</p>
              <p className="mt-1 text-sm text-white/90 italic">{p.tagline}</p>
            </div>
          </div>
          <Badge className="rounded-full bg-black/20 px-3 py-1 text-sm font-bold text-white backdrop-blur-sm border-0">
            {p.type}
          </Badge>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {p.strengths.map((str) => (
            <span key={str} className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white">
              <CheckCircle size={11} /> {str}
            </span>
          ))}
          {p.risks.map((r) => (
            <span key={r} className="flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-1 text-xs font-medium text-white">
              <AlertTriangle size={11} /> {r}
            </span>
          ))}
        </div>
      </div>

      {/* AI feedback */}
      <Section title="Multi-perspective feedback" icon={<Quote size={16} />}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FeedbackCard
            role="Project Manager"
            color="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900"
            text={projectManagerFeedback(s)}
          />
          <FeedbackCard
            role="Product Manager"
            color="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900"
            text={productManagerFeedback(s)}
          />
          <FeedbackCard
            role="CTO"
            color="bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-900"
            text={ctoFeedback(s, p)}
          />
        </div>
      </Section>

      {/* Overview row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Signal radar</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <PolarGrid stroke="currentColor" className="text-muted-foreground/20" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: "currentColor" }} className="text-muted-foreground" />
                <Radar dataKey="value" stroke={`url(#${radarGradId})`} fill={`url(#${radarGradId})`} fillOpacity={0.45} strokeWidth={2} />
                <defs>
                  <linearGradient id={radarGradId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
                <Tooltip formatter={(v: number) => [`${v}/100`]} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Score breakdown</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ScoreBar label="Delivery" value={p.scores.delivery} />
            <ScoreBar label="Activity" value={p.scores.activity} />
            <ScoreBar label="Quality" value={p.scores.quality} />
            <ScoreBar label="Collaboration" value={p.scores.collaboration} />
            <ScoreBar label="Breadth" value={p.scores.breadth} />
            <ScoreBar label="Consistency" value={p.scores.consistency} />
            <ScoreBar label="Commit size" value={p.scores.commitSize} />
            <ScoreBar label="WIP load" value={p.scores.wipLoad} goodHigh />
          </div>
        </Card>
      </div>

      {/* Delivery & consistency */}
      <Section title="Delivery & consistency" icon={<BarChart3 size={16} />}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="SP committed" value={s.total_sp_committed} />
          <Metric label="SP delivered" value={s.total_sp_delivered} />
          <Metric label="Delivery rate" value={s.delivery_rate_pct !== null ? `${s.delivery_rate_pct}%` : "—"} good={s.delivery_rate_pct !== null && s.delivery_rate_pct >= 80} />
          <Metric label="Tickets done" value={s.total_tickets_done} />
          <Metric label="Sprints participated" value={s.sprints_participated} />
          <Metric label="SP volatility" value={s.sp_volatility !== null ? `σ ${s.sp_volatility}%` : "—"} warn={s.sp_volatility !== null && s.sp_volatility > 35} />
          <Metric label="Avg sprint delivery" value={s.avg_sprint_delivery_ratio !== null ? `${s.avg_sprint_delivery_ratio}%` : "—"} />
          <Metric label="Measured sprints" value={s.measured_sprints} />
        </div>
      </Section>

      {/* Activity & quality */}
      <Section title="Activity & quality" icon={<Zap size={16} />}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Commits" value={s.commits} />
          <Metric label="Lines added" value={s.lines_added.toLocaleString()} />
          <Metric label="Lines deleted" value={s.lines_deleted.toLocaleString()} />
          <Metric label="Avg commit size" value={s.commits > 0 ? Math.round((s.lines_added + s.lines_deleted) / s.commits).toLocaleString() : "—"} />
          <Metric label="PRs authored" value={s.prs_authored} />
          <Metric label="PRs merged" value={s.prs_merged} />
          <Metric label="Avg merge time" value={s.avg_merge_hours !== null ? `${Math.round(s.avg_merge_hours)}h` : "—"} warn={s.avg_merge_hours !== null && s.avg_merge_hours > 48} />
          <Metric label="Concern ratio" value={`${s.concern_ratio_pct}%`} warn={s.concern_ratio_pct > 15} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <MiniMetric label="Feature PRs" value={s.feature_prs} />
          <MiniMetric label="Fix PRs" value={s.fix_prs} />
          <MiniMetric label="Refactor PRs" value={s.refactor_prs} />
          <MiniMetric label="Feature commits" value={s.feature_commits} />
          <MiniMetric label="Fix commits" value={s.fix_commits} />
          <MiniMetric label="Refactor commits" value={s.refactor_commits} />
        </div>
      </Section>

      {/* Collaboration & review */}
      <Section title="Collaboration & review" icon={<Users size={16} />}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="PRs reviewed" value={s.prs_reviewed} />
          <Metric label="PRs gated" value={s.prs_gated} />
          <Metric label="Approvals given" value={s.approvals_given} />
          <Metric label="Changes requested" value={s.changes_requested_given} warn={s.changes_requested_given > 0 && (s.reviewer_changes_ratio_pct ?? 0) > 40} />
          <Metric label="Reviewer rigor" value={s.reviewer_changes_ratio_pct !== null ? `${s.reviewer_changes_ratio_pct}%` : "—"} />
          <Metric label="Reviews received" value={s.prs_with_reviews} />
          <Metric label="Repos touched" value={s.repos_touched} />
          <Metric label="Sprints allocated" value={s.sprints_allocated} />
        </div>
        {(s.approvals_given > 0 || s.changes_requested_given > 0) && (
          <div className="mt-4 h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reviewMixData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      {/* WIP & load */}
      <Section title="WIP & load" icon={<FolderGit size={16} />}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Open PRs" value={s.open_prs} warn={s.open_prs >= 4} />
          <Metric label="Draft PRs" value={s.draft_prs} />
          <Metric label="Stuck PRs (>7d)" value={s.stuck_prs} warn={s.stuck_prs >= 2} />
          <Metric label="Open Jira tickets" value={s.open_issues} warn={s.open_issues > 50} />
          <Metric label="Peak hour" value={`${peakHourLabel(s.peak_hour_ist)} ${peakDowLabel(s.peak_dow)}`} icon={<Clock size={12} />} />
          <Metric label="After hours" value={`${s.after_hours_pct}%`} warn={s.after_hours_pct > 25} />
          <Metric label="Weekends" value={`${s.weekend_pct}%`} warn={s.weekend_pct > 10} />
          <Metric label="Effective hours" value={s.total_eff_hours} />
        </div>
      </Section>

      {/* Bus factor */}
      <Section title="Knowledge & bus factor" icon={<FileCode size={16} />}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Repos touched" value={s.repos_touched} />
          <Metric label="Sole-contributor repos" value={s.sole_repos} warn={s.sole_repos >= 2} />
          <Metric label="Dominant repos (>50%)" value={s.dominant_repos} warn={s.dominant_repos >= 2} />
          <Metric label="Bus factor score" value={s.bus_factor_score} warn={s.bus_factor_score >= 50} good={s.bus_factor_score < 30} />
        </div>
        {s.top_repos.length > 0 ? (
          <div className="mt-4 overflow-hidden rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Repo</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Commits</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Share</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Risk</th>
                </tr>
              </thead>
              <tbody>
                {s.top_repos.slice(0, 6).map((r) => (
                  <tr key={r.repo} className="border-t">
                    <td className="px-3 py-2 font-mono">{r.repo}</td>
                    <td className="px-3 py-2 text-right">{r.commits}/{r.total_commits}</td>
                    <td className="px-3 py-2 text-right">{r.share_pct}%</td>
                    <td className="px-3 py-2 text-right">
                      {r.sole_contributor ? (
                        <span className="text-amber-600 dark:text-amber-400">Sole</span>
                      ) : r.share_pct >= 50 ? (
                        <span className="text-amber-600 dark:text-amber-400">Dominant</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">Shared</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">No repo commit data available for bus-factor analysis.</p>
        )}
      </Section>

      <Section title="Technical debt & hygiene" icon={<Wrench size={16} />}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Hygiene score" value={s.hygiene_score} good={s.hygiene_score >= 70} warn={s.hygiene_score < 40} />
          <Metric label="Conventional commits" value={`${s.conventional_commits_pct}%`} good={s.conventional_commits_pct >= 60} warn={s.conventional_commits_pct < 30} />
          <Metric label="Debt markers" value={s.debt_markers} warn={s.debt_markers >= 5} />
          <Metric label="Merge commits" value={s.merge_commits} />
          <Metric label="Avg message length" value={s.avg_commit_message_length !== null ? `${Math.round(s.avg_commit_message_length)} chars` : "—"} />
          <Metric label="Feature/fix/refactor commits" value={`${s.feature_commits}/${s.fix_commits}/${s.refactor_commits}`} />
          <Metric label="Commits with PRs" value={s.prs_authored} />
          <Metric label="Debt / 100 commits" value={s.commits > 0 ? `${(s.debt_markers / s.commits * 100).toFixed(1)}` : "—"} warn={s.commits > 0 && s.debt_markers / s.commits > 0.05} />
        </div>
      </Section>

      <Section title="DORA metrics (Jenkins)" icon={<MessageSquare size={16} />}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Deployment frequency" value={`${s.deployment_frequency.toFixed(2)}/day`} good={s.deployment_frequency >= 1} warn={s.deployment_frequency > 0 && s.deployment_frequency < 1} />
          <Metric label="Change failure rate" value={`${s.change_failure_rate.toFixed(2)}%`} warn={s.change_failure_rate > 5} good={s.change_failure_rate <= 5 && s.change_failure_rate > 0} />
          <Metric label="MTTR" value={s.mttr_minutes > 0 ? `${Math.round(s.mttr_minutes)} min` : "—"} warn={s.mttr_minutes > 60} good={s.mttr_minutes > 0 && s.mttr_minutes <= 30} />
          <Metric label="Flaky-test patterns" value={s.flaky_tests} warn={s.flaky_tests >= 3} />
        </div>
        {s.deployment_frequency === 0 && s.change_failure_rate === 0 && s.mttr_minutes === 0 && s.flaky_tests === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">No Jenkins DORA data yet. Sync Jenkins or wait for the next metrics refresh.</p>
        )}
      </Section>
    </div>
  );
}

function PersonaDetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse space-y-6">
      <PlanningSubNav active="personas" />
      <div className="h-12 w-32 rounded bg-muted" />
      <div className="h-40 rounded-2xl bg-muted" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-64 rounded-xl bg-muted" />
        <div className="h-64 rounded-xl bg-muted lg:col-span-2" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-48 rounded-xl bg-muted" />
      ))}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon} {title}
      </h2>
      {children}
    </Card>
  );
}

function ScoreBar({ label, value, goodHigh = false }: { label: string; value: number; goodHigh?: boolean }) {
  const good = goodHigh ? value >= 70 : value >= 70 && label !== "WIP load";
  const warn = !goodHigh && value < 40;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${warn ? "text-amber-600" : good ? "text-emerald-600" : ""}`}>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${warn ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Metric({ label, value, warn, good, icon }: { label: string; value: string | number; warn?: boolean; good?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">{icon}{label}</p>
      <p className={`text-lg font-semibold ${warn ? "text-amber-600 dark:text-amber-400" : good ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-muted/30 p-2 text-center">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function FeedbackCard({ role, color, text }: { role: string; color: string; text: string }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground/80">{role} lens</h3>
      <div className="space-y-2 text-sm leading-relaxed text-foreground/90">
        {text.split("\n\n").map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  );
}
