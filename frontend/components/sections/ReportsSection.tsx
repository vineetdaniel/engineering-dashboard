"use client";

import { useMemo, useState } from "react";
import { FileText, Download, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { SectionProps } from "./types";
import { SectionHeader } from "./SectionHeader";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendChart } from "@/components/TrendChart";
import { BarChart3 } from "lucide-react";
import { SkeletonGrid } from "@/components/widgets/SkeletonGrid";
import { generateNewsletter } from "@/lib/api";

export function ReportsSection({ metrics, events, data, lastUpdated, dataSource }: SectionProps) {
  const [generating, setGenerating] = useState(false);

  const last7d = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return cutoff.toISOString();
  }, []);

  const summary = useMemo(() => {
    const recentEvents = events.filter((e) => e.happened_at >= last7d);
    const recentMetrics = metrics.filter((m) => m.timestamp >= last7d);

    const closedThisWeek = recentEvents.filter((e) => e.event_type === "merged_pr").length;
    const incidents = recentEvents.filter((e) => e.event_type === "incident" && e.status !== "resolved").length;
    const resolvedIncidents = recentEvents.filter((e) => e.event_type === "incident" && e.status === "resolved").length;
    const newCves = recentEvents.filter((e) => e.event_type === "dependabot_alert").length;
    const blockedTickets = recentEvents.filter((e) => e.event_type === "blocked_ticket" && e.status !== "resolved").length;
    const costDriverAlerts = recentEvents.filter((e) => e.event_type === "cost_driver").length;

    const mtdSpend = metrics.find((m) => m.metric_type === "cloud_spend_mtd")?.value ?? 0;
    const budgetUsed = metrics.find((m) => m.metric_type === "budget_used_pct")?.value ?? 0;
    const costPerTxn = metrics.find((m) => m.metric_type === "cost_per_transaction")?.value ?? null;
    const savings = metrics.find((m) => m.metric_type === "savings_opportunities")?.value ?? 0;

    const deploys = recentMetrics.filter((m) => m.metric_type === "deployment" || m.metric_type === "deployments").length;
    const failedDeploys = recentEvents.filter((e) => e.event_type === "deployment_failure").length;
    const changeFailureRate = deploys + failedDeploys > 0 ? (failedDeploys / (deploys + failedDeploys)) * 100 : 0;

    const openPrs = data.openPRs;
    const openBugs = data.openBugs;
    const openIssues = data.openIssues;

    const squadMetrics: Record<string, { prs: number; bugs: number; incidents: number }> = {};
    for (const m of recentMetrics) {
      const squad = m.meta?.squad || m.entity || "platform";
      if (!squadMetrics[squad]) squadMetrics[squad] = { prs: 0, bugs: 0, incidents: 0 };
      if (m.metric_type === "open_prs") squadMetrics[squad].prs += m.value || 0;
      if (m.metric_type === "open_bugs") squadMetrics[squad].bugs += m.value || 0;
    }
    for (const e of recentEvents) {
      const squad = e.meta?.squad || e.entity || "platform";
      if (!squadMetrics[squad]) squadMetrics[squad] = { prs: 0, bugs: 0, incidents: 0 };
      if (e.event_type === "incident") squadMetrics[squad].incidents += 1;
    }

    return {
      closedThisWeek,
      incidents,
      resolvedIncidents,
      newCves,
      blockedTickets,
      costDriverAlerts,
      mtdSpend,
      budgetUsed,
      costPerTxn,
      savings,
      deploys,
      failedDeploys,
      changeFailureRate,
      openPrs,
      openBugs,
      openIssues,
      squadMetrics,
      recentEvents,
    };
  }, [metrics, events, data, last7d]);

  const incidentTrend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });
    return days.map((day) => ({
      label: day.slice(5),
      value: events.filter((e) => e.event_type === "incident" && e.happened_at?.slice(0, 10) === day).length,
    }));
  }, [events]);

  const topCostDrivers = useMemo(() => {
    return metrics
      .filter((m) => m.metric_type === "cost_driver" && m.source === "aws_cost")
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 5)
      .map((m) => ({ label: m.entity || "Unknown", value: m.value || 0 }));
  }, [metrics]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const blob = await generateNewsletter();
      const url = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `cto-dash-newsletter-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      // eslint-disable-next-line no-console
      console.log("Newsletter generated");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Newsletter generation failed:", err);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Reports"
        description="Generate and download executive-ready tech newsletters"
        lastUpdated={lastUpdated}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <HighlightCard
          icon={CheckCircle2}
          label="PRs merged this week"
          value={summary.closedThisWeek}
          color="emerald"
        />
        <HighlightCard
          icon={AlertCircle}
          label="Open incidents"
          value={summary.incidents}
          subvalue={summary.resolvedIncidents > 0 ? `${summary.resolvedIncidents} resolved` : undefined}
          color="rose"
        />
        <HighlightCard
          icon={FileText}
          label="New CVEs"
          value={summary.newCves}
          color="amber"
        />
        <HighlightCard
          icon={BarChart3}
          label="Cloud budget used"
          value={`${Math.round(summary.budgetUsed)}%`}
          color="sky"
        />
      </div>

      <Widget>
        <WidgetHeader title="Tech Newsletter" subtitle="7-day executive summary (PDF)" dataSource={dataSource} />
        <div className="p-5">
          <p className="text-sm text-muted-foreground">
            Generates a one-page newsletter summarising engineering velocity, security posture, cost signals, and operational incidents from the last 7 days. Charts and tables are embedded directly in the PDF.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
              {generating ? <RefreshCw size={16} className="animate-spin" /> : <FileText size={16} />}
              {generating ? "Generating..." : "Create Newsletter"}
            </Button>
            <Button variant="outline" className="gap-2" asChild>
              <a href="/api/reports/newsletter?format=pdf" download>
                <Download size={16} />
                Download last
              </a>
            </Button>
          </div>
          {generating && <SkeletonGrid cols={2} rows={1} className="mt-4" />}
        </div>
      </Widget>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TrendChart
          title="Incident trend"
          subtitle="Daily incident count (last 7 days)"
          data={incidentTrend}
          type="bar"
          color="#f43f5e"
          dataSource={dataSource}
        />
        <TrendChart
          title="Top cost drivers"
          subtitle="AWS services by estimated spend"
          data={topCostDrivers}
          type="bar"
          color="#0ea5e9"
          dataSource={dataSource}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Engineering</CardTitle>
            <CardDescription>Open work in flight</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <MetricRow label="Open PRs" value={summary.openPrs} />
            <MetricRow label="Open issues" value={summary.openIssues} />
            <MetricRow label="Open bugs" value={summary.openBugs} />
            <MetricRow label="Blocked tickets" value={summary.blockedTickets} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Operations</CardTitle>
            <CardDescription>Deployment health</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <MetricRow label="Deployments" value={summary.deploys} />
            <MetricRow label="Failed deploys" value={summary.failedDeploys} />
            <MetricRow label="Change failure rate" value={`${summary.changeFailureRate.toFixed(1)}%`} />
            <MetricRow label="Cost alerts" value={summary.costDriverAlerts} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cost</CardTitle>
            <CardDescription>Cloud spend signals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <MetricRow label="MTD spend" value={`$${(summary.mtdSpend / 1000).toFixed(1)}k`} />
            <MetricRow label="Budget used" value={`${Math.round(summary.budgetUsed)}%`} />
            <MetricRow label="Savings opportunities" value={`$${(summary.savings / 1000).toFixed(1)}k`} />
            <MetricRow label="Cost / txn" value={summary.costPerTxn != null ? `$${summary.costPerTxn.toFixed(4)}` : "—"} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Squad spotlight</CardTitle>
          <CardDescription>7-day activity by squad</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Squad</th>
                  <th className="pb-2 font-medium">Open PRs</th>
                  <th className="pb-2 font-medium">Open bugs</th>
                  <th className="pb-2 font-medium">Incidents</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(summary.squadMetrics).map(([squad, vals]) => (
                  <tr key={squad} className="border-b last:border-0">
                    <td className="py-2 capitalize">{squad}</td>
                    <td className="py-2">{vals.prs}</td>
                    <td className="py-2">{vals.bugs}</td>
                    <td className="py-2">{vals.incidents}</td>
                  </tr>
                ))}
                {Object.keys(summary.squadMetrics).length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-muted-foreground">
                      No squad data for the last 7 days.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HighlightCard({
  icon: Icon,
  label,
  value,
  subvalue,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  subvalue?: string;
  color: "emerald" | "rose" | "amber" | "sky";
}) {
  const colorClass = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  }[color];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
            {subvalue && <p className="text-xs text-muted-foreground">{subvalue}</p>}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorClass}`}>
            <Icon size={20} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
