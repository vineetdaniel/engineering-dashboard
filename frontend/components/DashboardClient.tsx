"use client";

import { useState } from "react";
import {
  getConnectorHealth,
  syncSource,
  getMetrics,
  getEvents,
} from "@/lib/api";
import { MetricCard } from "./MetricCard";
import { EventList } from "./EventList";
import { ConnectorStatus } from "./ConnectorStatus";

export function DashboardClient({
  settings,
  initialHealth,
  initialMetrics,
  initialEvents,
}: {
  settings: any;
  initialHealth: any;
  initialMetrics: any[];
  initialEvents: any[];
}) {
  const [health, setHealth] = useState(initialHealth);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [events, setEvents] = useState(initialEvents);
  const [loading, setLoading] = useState<string | null>(null);

  async function refreshData() {
    const [m, e, h] = await Promise.all([
      getMetrics(),
      getEvents(),
      getConnectorHealth(),
    ]);
    setMetrics(m);
    setEvents(e);
    setHealth(h);
  }

  async function handleSync(source: string) {
    setLoading(source);
    await syncSource(source);
    await refreshData();
    setLoading(null);
  }

  const openPRs = metrics
    .filter((m) => m.metric_type === "open_prs")
    .reduce((acc, m) => acc + (m.value || 0), 0);

  const openIssues = metrics
    .filter((m) => m.metric_type === "open_issues")
    .reduce((acc, m) => acc + (m.value || 0), 0);

  const openBugs = metrics
    .filter((m) => m.metric_type === "open_bugs")
    .reduce((acc, m) => acc + (m.value || 0), 0);

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CTO Dash</h1>
          <p className="text-slate-400">
            Fintech engineering pulse · Observability: {settings?.observability_provider || "—"}
          </p>
        </div>
        <div className="flex gap-2">
          {["github", "jira", "observability"].map((source) => (
            <button
              key={source}
              onClick={() => handleSync(source)}
              disabled={loading === source}
              className="px-4 py-2 bg-cto-accent text-cto-900 rounded font-semibold disabled:opacity-50"
            >
              {loading === source ? `Syncing ${source}…` : `Sync ${source}`}
            </button>
          ))}
          <button
            onClick={refreshData}
            className="px-4 py-2 border border-slate-600 rounded hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>
      </header>

      <ConnectorStatus health={health} />

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <MetricCard title="Open PRs" value={openPRs} />
        <MetricCard title="Open Issues" value={openIssues} />
        <MetricCard title="Open Bugs" value={openBugs} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EventList title="Blocked Tickets" events={events.filter((e) => e.event_type === "blocked_ticket")} />
        <EventList title="Security Alerts" events={events.filter((e) => e.event_type === "dependabot_alert")} />
      </section>
    </main>
  );
}
