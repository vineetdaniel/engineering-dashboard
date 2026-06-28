"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { PlanningSubNav } from "./PlanningSubNav";
import { PersonaCard } from "./PersonaCard";
import { getDeveloperSignals, type DeveloperSignal } from "@/lib/api";
import { buildPersonas, type PersonaType, type DeveloperPersona } from "@/lib/persona";

const PERSONA_TYPES: PersonaType[] = [
  "Anchor", "Builder", "Consistent", "Reviewer",
  "Deep Worker", "Fixer", "Overloaded", "Emerging",
];

const TYPE_COLORS: Record<PersonaType, string> = {
  Anchor:       "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  Builder:      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Fixer:        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  Reviewer:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  Overloaded:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  "Deep Worker":"bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  Consistent:   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  Emerging:     "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export function PersonasClient() {
  const [personas, setPersonas] = useState<DeveloperPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PersonaType | "all">("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "delivery" | "activity" | "risk">("delivery");

  useEffect(() => {
    getDeveloperSignals()
      .then((signals) => {
        const arr = Array.isArray(signals) ? signals : [];
        if (!Array.isArray(signals)) {
          console.error("PersonasClient: expected array from getDeveloperSignals, got", typeof signals, signals);
        }
        setPersonas(buildPersonas(arr));
      })
      .catch((err) => {
        console.error("PersonasClient: failed to load developer signals", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const teams = ["all", ...Array.from(new Set(personas.map((p) => p.signal.team ?? "Other"))).sort()];

  const typeCounts = personas.reduce<Record<string, number>>((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1;
    return acc;
  }, {});

  const filtered = personas
    .filter((p) => filter === "all" || p.type === filter)
    .filter((p) => teamFilter === "all" || p.signal.team === teamFilter)
    .sort((a, b) => {
      if (sortBy === "name") return a.signal.name.localeCompare(b.signal.name);
      if (sortBy === "delivery") return b.scores.delivery - a.scores.delivery;
      if (sortBy === "activity") return b.scores.activity - a.scores.activity;
      if (sortBy === "risk") return b.signal.open_issues - a.signal.open_issues;
      return 0;
    });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Engineering personas</h1>
        <p className="text-sm text-muted-foreground">
          Developer archetypes derived from GitHub, Jira, and sprint planning signals.
        </p>
      </div>

      <PlanningSubNav active="personas" />

      {/* Persona type summary */}
      {!loading && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            All ({personas.length})
          </button>
          {PERSONA_TYPES.filter((t) => typeCounts[t]).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(filter === t ? "all" : t)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filter === t ? "bg-primary text-primary-foreground" : TYPE_COLORS[t]}`}
            >
              {t} ({typeCounts[t] ?? 0})
            </button>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2 text-xs">
          {teams.map((t) => <option key={t} value={t}>{t === "all" ? "All teams" : t}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="h-8 rounded-lg border border-input bg-background px-2 text-xs">
          <option value="delivery">Sort: Delivery</option>
          <option value="activity">Sort: Activity</option>
          <option value="risk">Sort: Risk (open issues)</option>
          <option value="name">Sort: Name</option>
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length} developers</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-80 animate-pulse bg-muted border-0" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No developers match this filter.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <PersonaCard key={p.signal.name} persona={p} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Personas are computed from 90-day GitHub activity, Jira sprint history, and planning allocations.
        Click any card to expand detailed breakdown. Sync connectors to refresh.
      </p>
    </div>
  );
}
