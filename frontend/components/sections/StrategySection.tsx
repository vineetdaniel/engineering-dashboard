"use client";

import { useEffect, useMemo, useState } from "react";
import { Compass, Sparkles, Save, ArrowRight, Target, TrendingUp, AlertTriangle, Users, Bot } from "lucide-react";
import { SectionProps } from "./types";
import { SectionHeader } from "./SectionHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  saveStrategy,
  generateStrategy,
  type StrategyGoals,
  type StrategyActionItem,
  type StrategyGenerateOut,
} from "@/lib/api";

const emptyGoals: StrategyGoals = {
  six_month: "",
  quarterly: "",
  weekly: "",
  ai_strategy_focus: "",
  top_risks: "",
  growth_levers: "",
  team_capacity_notes: "",
};

function priorityVariant(priority: string) {
  switch (priority) {
    case "critical":
      return "danger";
    case "high":
      return "warning";
    case "medium":
      return "info";
    default:
      return "secondary";
  }
}

function sectionHref(section: string) {
  if (section === "strategy") return "?section=strategy";
  return `?section=${section}`;
}

function formatUpdatedAt(iso: string | null) {
  if (!iso) return "Not saved yet";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function StrategySection({
  filters,
  data,
  metrics,
  strategyGoals,
  onStrategyRefresh,
}: SectionProps) {
  const initial = strategyGoals?.goals || emptyGoals;
  const [goals, setGoals] = useState<StrategyGoals>(initial);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<StrategyGenerateOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  // Keep local form in sync when strategyGoals prop updates (e.g. first load).
  useEffect(() => {
    if (strategyGoals?.goals) {
      setGoals(strategyGoals.goals);
    }
  }, [strategyGoals]);

  const hasGoals = useMemo(
    () =>
      Boolean(
        goals.six_month || goals.quarterly || goals.weekly || goals.ai_strategy_focus
      ),
    [goals]
  );

  const snapshot = useMemo(() => {
    return {
      openPRs: data.openPRs,
      openBugs: data.openBugs,
      activeIncidents: data.activeIncidents.length,
      p0p1Incidents: data.p0p1Incidents.length,
      criticalCVEs: data.cves.filter((e) => ["critical", "high"].includes(e.severity)).length,
      paymentSuccessRate:
        metrics.find((m) => m.metric_type === "payment_success_rate")?.value ?? null,
      uptime: metrics.find((m) => m.metric_type === "uptime_pct")?.value ?? null,
      cloudSpend: metrics.find((m) => m.metric_type === "cloud_spend_mtd")?.value ?? null,
    };
  }, [data, metrics]);

  function updateGoal(key: keyof StrategyGoals, value: string) {
    setGoals((g) => ({ ...g, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveStrategy(goals);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
      onStrategyRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save strategy");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await generateStrategy(filters);
      setResult(res);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Failed to generate strategy");
    } finally {
      setGenerating(false);
    }
  }

  const fieldClass = "space-y-2";

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Strategy"
        description="Set your aims, then let accumulated engineering data shape a CTO-level plan of action."
        lastUpdated={null}
      />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Form */}
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Target size={18} className="text-primary" />
                <CardTitle>Strategic Aims</CardTitle>
              </div>
              <CardDescription>
                Define what winning looks like. The more context you give, the sharper the derived action items.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className={fieldClass}>
                <Label htmlFor="six_month">6-month aim</Label>
                <Textarea
                  id="six_month"
                  placeholder="e.g. Launch in two new markets, halve payment latency, and reach 99.99% uptime."
                  value={goals.six_month}
                  onChange={(e) => updateGoal("six_month", e.target.value)}
                />
              </div>

              <div className={fieldClass}>
                <Label htmlFor="quarterly">Quarterly focus</Label>
                <Textarea
                  id="quarterly"
                  placeholder="e.g. Ship the new checkout flow, harden fraud detection, and clear the critical CVE backlog."
                  value={goals.quarterly}
                  onChange={(e) => updateGoal("quarterly", e.target.value)}
                />
              </div>

              <div className={fieldClass}>
                <Label htmlFor="weekly">This week</Label>
                <Input
                  id="weekly"
                  placeholder="e.g. Close P0 incidents, unblock stuck PRs, finalize AI use-case shortlist."
                  value={goals.weekly}
                  onChange={(e) => updateGoal("weekly", e.target.value)}
                />
              </div>

              <div className={fieldClass}>
                <div className="flex items-center gap-2">
                  <Bot size={16} className="text-primary" />
                  <Label htmlFor="ai_strategy_focus">AI strategy focus</Label>
                </div>
                <Textarea
                  id="ai_strategy_focus"
                  placeholder="e.g. Customer support automation, fraud anomaly detection, developer productivity copilots, or 'none yet'."
                  value={goals.ai_strategy_focus}
                  onChange={(e) => updateGoal("ai_strategy_focus", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className={fieldClass}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500" />
                    <Label htmlFor="top_risks">Top risks</Label>
                  </div>
                  <Textarea
                    id="top_risks"
                    placeholder="Talent gaps, legacy debt, vendor concentration, compliance deadlines..."
                    value={goals.top_risks}
                    onChange={(e) => updateGoal("top_risks", e.target.value)}
                  />
                </div>

                <div className={fieldClass}>
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-emerald-500" />
                    <Label htmlFor="growth_levers">Growth levers</Label>
                  </div>
                  <Textarea
                    id="growth_levers"
                    placeholder="New products, geos, partnerships, platform capabilities..."
                    value={goals.growth_levers}
                    onChange={(e) => updateGoal("growth_levers", e.target.value)}
                  />
                </div>
              </div>

              <div className={fieldClass}>
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-indigo-500" />
                  <Label htmlFor="team_capacity_notes">Team capacity notes</Label>
                </div>
                <Textarea
                  id="team_capacity_notes"
                  placeholder="Hiring plans, PTO/load, skill gaps, vendor/agency support..."
                  value={goals.team_capacity_notes}
                  onChange={(e) => updateGoal("team_capacity_notes", e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button onClick={handleSave} disabled={saving} variant="default">
                  <Save size={16} />
                  {saving ? "Saving..." : justSaved ? "Saved" : "Save strategy"}
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={generating || !hasGoals}
                  variant="accent"
                >
                  <Sparkles size={16} />
                  {generating ? "Generating..." : "Generate CTO strategy"}
                </Button>
                {!hasGoals && (
                  <span className="text-xs text-muted-foreground">Fill at least one aim to generate strategy.</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Last saved: {formatUpdatedAt(strategyGoals?.updated_at || null)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Snapshot */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Compass size={18} className="text-primary" />
                <CardTitle>Live data snapshot</CardTitle>
              </div>
              <CardDescription>Signals feeding the strategy engine.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <SnapshotRow label="Open PRs" value={snapshot.openPRs} />
              <SnapshotRow label="Open bugs" value={snapshot.openBugs} />
              <SnapshotRow label="Active incidents" value={snapshot.activeIncidents} />
              <SnapshotRow label="P0/P1 incidents" value={snapshot.p0p1Incidents} />
              <SnapshotRow label="Critical/high CVEs" value={snapshot.criticalCVEs} />
              <SnapshotRow
                label="Payment success"
                value={snapshot.paymentSuccessRate}
                format={(v) => `${v?.toFixed ? v.toFixed(2) : v}%`}
              />
              <SnapshotRow
                label="Uptime"
                value={snapshot.uptime}
                format={(v) => `${v?.toFixed ? v.toFixed(2) : v}%`}
              />
              <SnapshotRow
                label="Cloud spend MTD"
                value={snapshot.cloudSpend}
                format={(v) => (v ? `$${Number(v).toLocaleString()}` : "—")}
              />
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-600/10 to-violet-600/10">
            <CardContent className="pt-6">
              <p className="text-sm font-medium">Strategy is the epicenter of accumulated data.</p>
              <p className="mt-2 text-xs text-muted-foreground">
                The engine blends your stated aims with PRs, incidents, CVEs, payment metrics, uptime, and spend to
                suggest short-term actions from a seasoned CTO point of view.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Generated output */}
      {result && (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-primary" />
                  <CardTitle>CTO Strategy Narrative</CardTitle>
                </div>
                <div className="flex gap-2">
                  {result.llm_enhanced && (
                    <Badge variant="info">LLM enhanced</Badge>
                  )}
                  <Badge variant={result.data_driven ? "success" : "secondary"}>
                    {result.data_driven ? "Data-driven" : "Goal-based"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose dark:prose-invert max-w-none text-sm">
                {result.narrative.split("\n\n").map((para, idx) => (
                  <p key={idx} className="mb-3 last:mb-0">
                    {para.startsWith("**") && para.includes("**")
                      ? para.split("**").map((part, i) =>
                          i % 2 === 1 ? (
                            <strong key={i} className="text-foreground">{part}</strong>
                          ) : (
                            <span key={i}>{part}</span>
                          )
                        )
                      : para}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {result.action_items.map((item) => (
              <ActionCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SnapshotRow({
  label,
  value,
  format,
}: {
  label: string;
  value: number | null;
  format?: (v: number | null) => string;
}) {
  const display = value == null ? "—" : format ? format(value) : value;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{display}</span>
    </div>
  );
}

function ActionCard({ item }: { item: StrategyActionItem }) {
  return (
    <Card className={cn("transition hover:shadow-card-hover", item.priority === "critical" && "border-rose-200 dark:border-rose-900")}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
              <Badge variant="outline">{item.section}</Badge>
              {item.due_hint && (
                <span className="text-xs text-muted-foreground">Due: {item.due_hint}</span>
              )}
            </div>
            <h4 className="mt-2 text-sm font-semibold">{item.title}</h4>
            <p className="mt-1 text-xs text-muted-foreground">{item.rationale}</p>
          </div>
          <a
            href={sectionHref(item.section)}
            className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            title={`Open ${item.section} section`}
          >
            <ArrowRight size={16} />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
