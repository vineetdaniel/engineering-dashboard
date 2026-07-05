"use client";

import { useState } from "react";
import { FlaskConical, RotateCcw, Play, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { generateWhatIf, type ApiFilters, type WhatIfScenarioOut } from "@/lib/api";

interface WhatIfScenarioProps {
  filters?: ApiFilters;
}

const METRIC_SLIDERS = [
  { key: "uptime_pct", label: "Uptime", min: 95, max: 100, step: 0.01, unit: "%" },
  { key: "payment_success_rate", label: "Payment success", min: 95, max: 100, step: 0.01, unit: "%" },
  { key: "open_prs", label: "Open PRs", min: 0, max: 200, step: 1, unit: "" },
  { key: "open_bugs", label: "Open bugs", min: 0, max: 200, step: 1, unit: "" },
  { key: "fraud_rate", label: "Fraud rate", min: 0, max: 3, step: 0.01, unit: "%" },
  { key: "cloud_spend_mtd", label: "Cloud spend MTD", min: 0, max: 100000, step: 1000, unit: "$" },
];

const EVENT_SLIDERS = [
  { key: "incident", label: "Active incidents", min: -10, max: 10, step: 1 },
  { key: "dependabot_alert", label: "Dependabot alerts", min: -20, max: 20, step: 1 },
  { key: "blocked_ticket", label: "Blocked tickets", min: -10, max: 10, step: 1 },
];

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-amber-500";
  if (score >= 40) return "text-rose-500";
  return "text-red-600";
}

export function WhatIfScenario({ filters }: WhatIfScenarioProps) {
  const [metricOverrides, setMetricOverrides] = useState<Record<string, number | null>>({});
  const [eventOverrides, setEventOverrides] = useState<Record<string, number | null>>({});
  const [scenario, setScenario] = useState<WhatIfScenarioOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateMetric(key: string, value: number | null) {
    setMetricOverrides((prev) => ({ ...prev, [key]: value }));
  }

  function updateEvent(key: string, value: number | null) {
    setEventOverrides((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setMetricOverrides({});
    setEventOverrides({});
    setScenario(null);
    setError(null);
  }

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await generateWhatIf(metricOverrides, eventOverrides, filters);
      setScenario(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run scenario");
    } finally {
      setLoading(false);
    }
  }

  const hasOverrides = Object.values(metricOverrides).some((v) => v != null) || Object.values(eventOverrides).some((v) => v != null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical size={18} className="text-primary" />
            <CardTitle>Scenario / What-If Mode</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw size={14} /> Reset
          </Button>
        </div>
        <CardDescription>
          Adjust key metrics and events to simulate how the strategy health score and action plan would change.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Metric overrides</h4>
            {METRIC_SLIDERS.map((slider) => (
              <SliderRow
                key={slider.key}
                label={slider.label}
                min={slider.min}
                max={slider.max}
                step={slider.step}
                unit={slider.unit}
                value={metricOverrides[slider.key]}
                onChange={(v) => updateMetric(slider.key, v)}
              />
            ))}
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Event overrides</h4>
            {EVENT_SLIDERS.map((slider) => (
              <SliderRow
                key={slider.key}
                label={slider.label}
                min={slider.min}
                max={slider.max}
                step={slider.step}
                unit=""
                value={eventOverrides[slider.key]}
                onChange={(v) => updateEvent(slider.key, v)}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={run} disabled={loading || !hasOverrides}>
            <Play size={16} /> {loading ? "Running..." : "Run scenario"}
          </Button>
          {!hasOverrides && (
            <span className="text-xs text-muted-foreground">Move at least one slider to run a scenario.</span>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
            {error}
          </div>
        )}

        {scenario && <ScenarioResult scenario={scenario} />}
      </CardContent>
    </Card>
  );
}

function SliderRow({
  label,
  min,
  max,
  step,
  unit,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  value?: number | null;
  onChange: (value: number | null) => void;
}) {
  const displayValue = value ?? "current";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {displayValue === "current" ? "current" : `${unit}${displayValue}`}
          </span>
          {value != null && (
            <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px]" onClick={() => onChange(null)}>
              clear
            </Button>
          )}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value ?? min + (max - min) / 2}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

function ScenarioResult({ scenario }: { scenario: WhatIfScenarioOut }) {
  const base = scenario.baseline_health_score.score;
  const sc = scenario.scenario_health_score.score;
  const delta = sc - base;

  return (
    <div className="space-y-5 rounded-xl border border-border bg-muted/30 p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ScoreCard label="Baseline" score={base} />
        <ScoreCard label="Scenario" score={sc} />
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-3 text-center">
          <span className="text-xs text-muted-foreground">Score delta</span>
          <div className={cn("mt-1 flex items-center gap-1 text-lg font-bold", delta >= 0 ? "text-emerald-500" : "text-rose-500")}>
            {delta >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Baseline health</span>
          <span className="font-medium">{base.toFixed(1)}</span>
        </div>
        <Progress value={base} className="h-2" />
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Scenario health</span>
          <span className="font-medium">{sc.toFixed(1)}</span>
        </div>
        <Progress value={sc} className="h-2" />
      </div>

      <div className="grid grid-cols-2 gap-3 text-center text-xs">
        <div className="rounded-lg border border-border bg-card p-2">
          <span className="text-muted-foreground">Baseline actions</span>
          <div className="text-sm font-semibold">{scenario.baseline_action_count}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-2">
          <span className="text-muted-foreground">Scenario actions</span>
          <div className="text-sm font-semibold">{scenario.scenario_action_count}</div>
        </div>
      </div>

      {(scenario.new_action_items.length > 0 || scenario.removed_action_items.length > 0) && (
        <div className="space-y-3">
          {scenario.new_action_items.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">New actions in scenario</h5>
              <ul className="space-y-1">
                {scenario.new_action_items.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-xs">
                    <ArrowRight size={12} className="text-emerald-500" />
                    <span>{a.title}</span>
                    <Badge variant="outline">{a.section}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {scenario.removed_action_items.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-rose-600 dark:text-rose-400">Actions removed in scenario</h5>
              <ul className="space-y-1">
                {scenario.removed_action_items.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">— {a.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreCard({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-3 text-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-2xl font-bold", scoreColor(score))}>{score.toFixed(1)}</span>
    </div>
  );
}
