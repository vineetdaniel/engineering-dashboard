"use client";

import { useMemo, useState, useEffect, Suspense, useCallback } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { getConnectorHealth, syncSource, getMetrics, getEvents } from "@/lib/api";
import { type FilterState } from "@/components/GlobalFilters";
import { SkeletonGrid } from "@/components/widgets/SkeletonGrid";
import { WidgetErrorBoundary } from "@/components/WidgetErrorBoundary";
import { IncidentBanner } from "@/components/IncidentBanner";

const SectionLoader = () => (
  <div className="mx-auto max-w-7xl space-y-5 py-2">
    <SkeletonGrid cols={4} rows={2} />
    <SkeletonGrid cols={3} rows={2} />
    <SkeletonGrid cols={4} rows={1} />
  </div>
);

const OverviewSection = dynamic(() => import("@/components/sections/OverviewSection").then((m) => m.OverviewSection), {
  loading: () => <SectionLoader />,
});
const EngineeringSection = dynamic(() => import("@/components/sections/EngineeringSection").then((m) => m.EngineeringSection), {
  loading: () => <SectionLoader />,
});
const ProductSection = dynamic(() => import("@/components/sections/ProductSection").then((m) => m.ProductSection), {
  loading: () => <SectionLoader />,
});
const OperationsSection = dynamic(() => import("@/components/sections/OperationsSection").then((m) => m.OperationsSection), {
  loading: () => <SectionLoader />,
});
const SecuritySection = dynamic(() => import("@/components/sections/SecuritySection").then((m) => m.SecuritySection), {
  loading: () => <SectionLoader />,
});
const CostSection = dynamic(() => import("@/components/sections/CostSection").then((m) => m.CostSection), {
  loading: () => <SectionLoader />,
});
const TeamSection = dynamic(() => import("@/components/sections/TeamSection").then((m) => m.TeamSection), {
  loading: () => <SectionLoader />,
});
const SettingsSection = dynamic(() => import("@/components/sections/SettingsSection").then((m) => m.SettingsSection), {
  loading: () => <SectionLoader />,
});
const PaymentsSection = dynamic(() => import("@/components/sections/PaymentsSection").then((m) => m.PaymentsSection), {
  loading: () => <SectionLoader />,
});
const ComplianceSection = dynamic(() => import("@/components/sections/ComplianceSection").then((m) => m.ComplianceSection), {
  loading: () => <SectionLoader />,
});
const ReportsSection = dynamic(() => import("@/components/sections/ReportsSection").then((m) => m.ReportsSection), {
  loading: () => <SectionLoader />,
});

interface DashboardClientProps {
  settings: any;
  initialHealth: any;
  initialMetrics: any[];
  initialEvents: any[];
}

const VALID_SECTIONS = new Set([
  "overview",
  "engineering",
  "product",
  "operations",
  "payments",
  "security",
  "compliance",
  "cost",
  "reports",
  "team",
  "settings",
]);

const VALID_DATE_RANGES = new Set<FilterState["dateRange"]>(["24h", "7d", "30d", "90d"]);
const VALID_SQUADS = new Set<FilterState["squad"]>(["all", "platform", "payments", "data", "security"]);
const VALID_ENVIRONMENTS = new Set<FilterState["environment"]>(["all", "prod", "staging"]);

function readFiltersFromUrl(searchParams: URLSearchParams | null): Partial<FilterState> {
  if (!searchParams) return {};
  const dateRange = searchParams.get("dateRange") as FilterState["dateRange"] | null;
  const squad = searchParams.get("squad") as FilterState["squad"] | null;
  const environment = searchParams.get("environment") as FilterState["environment"] | null;
  const partial: Partial<FilterState> = {};
  if (dateRange && VALID_DATE_RANGES.has(dateRange)) partial.dateRange = dateRange;
  if (squad && VALID_SQUADS.has(squad)) partial.squad = squad;
  if (environment && VALID_ENVIRONMENTS.has(environment)) partial.environment = environment;
  return partial;
}

export function DashboardClient({
  settings,
  initialHealth,
  initialMetrics,
  initialEvents,
}: DashboardClientProps) {
  const searchParams = useSearchParams();
  const urlSection = searchParams.get("section");
  const initialSection = urlSection && VALID_SECTIONS.has(urlSection) ? urlSection : "overview";

  const [active, setActiveState] = useState(initialSection);
  const [health, setHealth] = useState(initialHealth);

  // Sync active section with URL changes when the same page is re-rendered
  // with a different ?section= query param (e.g. sidebar clicks).
  useEffect(() => {
    const next = urlSection && VALID_SECTIONS.has(urlSection) ? urlSection : "overview";
    if (next !== active) {
      setActiveState(next);
    }
  }, [urlSection, active]);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [events, setEvents] = useState(initialEvents);
  const [healthLoading, setHealthLoading] = useState(true);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backendOk, setBackendOk] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [commandOpen, setCommandOpen] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ source: string; metrics: number; events: number } | null>(null);

  const dataSource: "live" | "seed" | "mixed" | "dummy" = useMemo(() => {
    const all = [...metrics, ...events];
    if (all.length === 0) return "dummy";
    const live = all.some((x) => x.is_seed === false);
    const seed = all.some((x) => x.is_seed === true);
    if (live && seed) return "mixed";
    if (live) return "live";
    return "seed";
  }, [metrics, events]);
  const [filters, setFiltersState] = useState<FilterState>({
    dateRange: "7d",
    squad: "all",
    environment: "all",
    ...readFiltersFromUrl(searchParams),
  });

  const updateUrl = useCallback((next: { section?: string; filters?: FilterState }) => {
    const params = new URLSearchParams(window.location.search);
    if (next.section) params.set("section", next.section);
    if (next.filters) {
      if (next.filters.dateRange === "7d") params.delete("dateRange");
      else params.set("dateRange", next.filters.dateRange);
      if (next.filters.squad === "all") params.delete("squad");
      else params.set("squad", next.filters.squad);
      if (next.filters.environment === "all") params.delete("environment");
      else params.set("environment", next.filters.environment);
    }
    const url = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", url);
  }, []);

  function setActive(next: string) {
    setActiveState(next);
    updateUrl({ section: next, filters });
  }

  function setFilters(next: FilterState) {
    setFiltersState(next);
    updateUrl({ section: active, filters: next });
  }

  async function refreshData() {
    setError(null);
    try {
      const [m, e] = await Promise.all([
        getMetrics(filters),
        getEvents(filters),
      ]);
      setMetrics(m);
      setEvents(e);
      setBackendOk(true);
      setLastUpdated(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Refresh failed";
      setError(message);
      setBackendOk(false);
    }
  }

  async function refreshHealth() {
    try {
      setHealthLoading(true);
      const h = await getConnectorHealth();
      setHealth(h);
    } catch (err) {
      console.error("Connector health refresh failed", err);
    } finally {
      setHealthLoading(false);
    }
  }

  async function handleSync(source: string) {
    setError(null);
    setLoading(source);
    try {
      const result = await syncSource(source);
      setLastSyncResult(result);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${source} sync failed`);
      setLastSyncResult(null);
    } finally {
      setLoading(null);
    }
  }

  useEffect(() => {
    refreshData();
  }, [filters]);

  useEffect(() => {
    refreshHealth();
  }, []);

  useEffect(() => {
    const dataInterval = setInterval(() => {
      refreshData();
    }, 60000);
    const healthInterval = setInterval(() => {
      refreshHealth();
    }, 120000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(healthInterval);
    };
  }, [filters]);

  const data = useMemo(() => {
    const openPRs = metrics
      .filter((m) => m.metric_type === "open_prs")
      .reduce((a, m) => a + (m.value || 0), 0);
    const openIssues = metrics
      .filter((m) => m.metric_type === "open_issues")
      .reduce((a, m) => a + (m.value || 0), 0);
    const openBugs = metrics
      .filter((m) => m.metric_type === "open_bugs")
      .reduce((a, m) => a + (m.value || 0), 0);
    const stuckPRs = events.filter((e) => e.event_type === "stuck_pr");
    const blocked = events.filter((e) => e.event_type === "blocked_ticket");
    const cves = events.filter((e) => e.event_type === "dependabot_alert");
    const criticalCount = cves.filter((e) => ["critical", "high"].includes(e.severity)).length;
    const activeIncidents = events.filter((e) => e.event_type === "incident" && e.status !== "resolved");
    const p0p1Incidents = activeIncidents.filter((e) => ["critical", "high"].includes(e.severity));
    return { openPRs, openIssues, openBugs, stuckPRs, blocked, cves, criticalCount, activeIncidents, p0p1Incidents };
  }, [metrics, events]);

  const sectionProps = {
    settings,
    health,
    metrics,
    events,
    data,
    filters,
    onSync: handleSync,
    syncLoading: loading,
    lastUpdated,
    lastSyncResult,
    dataSource,
    healthLoading,
  };

  return (
    <DashboardShell activeSection={active} className="p-4 pb-20 md:pb-4 lg:p-6">
      <IncidentBanner count={data.p0p1Incidents.length} />

      {!backendOk && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>Backend unreachable.</strong> Start the API with:{" "}
          <code className="rounded bg-muted px-1 py-0.5 dark:bg-black/20">
            uvicorn backend.api.main:app --port 8000
          </code>
          . Showing cached data.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-amber-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
          {error}
        </div>
      )}

      {active === "overview" && (
        <Suspense fallback={<SectionLoader />}>
          <WidgetErrorBoundary>
            <OverviewSection {...sectionProps} />
          </WidgetErrorBoundary>
        </Suspense>
      )}
      {active === "engineering" && (
        <Suspense fallback={<SectionLoader />}>
          <WidgetErrorBoundary>
            <EngineeringSection {...sectionProps} />
          </WidgetErrorBoundary>
        </Suspense>
      )}
      {active === "product" && (
        <Suspense fallback={<SectionLoader />}>
          <WidgetErrorBoundary>
            <ProductSection {...sectionProps} />
          </WidgetErrorBoundary>
        </Suspense>
      )}
      {active === "operations" && (
        <Suspense fallback={<SectionLoader />}>
          <WidgetErrorBoundary>
            <OperationsSection {...sectionProps} />
          </WidgetErrorBoundary>
        </Suspense>
      )}
      {active === "security" && (
        <Suspense fallback={<SectionLoader />}>
          <WidgetErrorBoundary>
            <SecuritySection {...sectionProps} />
          </WidgetErrorBoundary>
        </Suspense>
      )}
      {active === "compliance" && (
        <Suspense fallback={<SectionLoader />}>
          <WidgetErrorBoundary>
            <ComplianceSection {...sectionProps} />
          </WidgetErrorBoundary>
        </Suspense>
      )}
      {active === "cost" && (
        <Suspense fallback={<SectionLoader />}>
          <WidgetErrorBoundary>
            <CostSection {...sectionProps} />
          </WidgetErrorBoundary>
        </Suspense>
      )}
      {active === "team" && (
        <Suspense fallback={<SectionLoader />}>
          <WidgetErrorBoundary>
            <TeamSection {...sectionProps} />
          </WidgetErrorBoundary>
        </Suspense>
      )}
      {active === "payments" && (
        <Suspense fallback={<SectionLoader />}>
          <WidgetErrorBoundary>
            <PaymentsSection {...sectionProps} />
          </WidgetErrorBoundary>
        </Suspense>
      )}
      {active === "settings" && (
        <Suspense fallback={<SectionLoader />}>
          <WidgetErrorBoundary>
            <SettingsSection {...sectionProps} />
          </WidgetErrorBoundary>
        </Suspense>
      )}
      {active === "reports" && (
        <Suspense fallback={<SectionLoader />}>
          <WidgetErrorBoundary>
            <ReportsSection {...sectionProps} />
          </WidgetErrorBoundary>
        </Suspense>
      )}
    </DashboardShell>
  );
}
