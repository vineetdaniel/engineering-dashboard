export const dynamic = "force-dynamic";

import {
  getSettings,
  getMetrics,
  getEvents,
} from "@/lib/api";
import { DashboardClient } from "@/components/DashboardClient";

const VALID_DATE_RANGES = ["24h", "7d", "30d", "90d"] as const;

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const dateRangeParam = params?.dateRange;
  const dateRange: (typeof VALID_DATE_RANGES)[number] =
    typeof dateRangeParam === "string" && (VALID_DATE_RANGES as readonly string[]).includes(dateRangeParam)
      ? (dateRangeParam as (typeof VALID_DATE_RANGES)[number])
      : "7d";
  const filters = { dateRange };

  let settings: any = { observability_provider: "—" };
  let metrics: any[] = [];
  let events: any[] = [];
  let error: string | null = null;

  try {
    const [settingsRes, metricsRes, eventsRes] = await Promise.all([
      getSettings(),
      getMetrics(filters),
      getEvents(filters),
    ]);
    settings = settingsRes;
    metrics = metricsRes;
    events = eventsRes;
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load dashboard data";
    console.error("Dashboard SSR error:", err);
  }

  // Connector health is intentionally fetched client-side in DashboardClient
  // because it can be slow (it calls external APIs). Do NOT await it here.
  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="glossy-card max-w-md p-8 text-center">
          <h1 className="text-2xl font-bold text-gradient">CTO Dash</h1>
          <p className="mt-2 text-sm text-muted-foreground">Unable to reach the dashboard backend.</p>
          <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error}</p>
          <p className="mt-4 text-xs text-muted-foreground">
            Start backend:{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              uvicorn backend.api.main:app --port 8000
            </code>
          </p>
        </div>
      </main>
    );
  }

  return (
    <DashboardClient
      settings={settings}
      initialHealth={null}
      initialMetrics={metrics}
      initialEvents={events}
    />
  );
}
