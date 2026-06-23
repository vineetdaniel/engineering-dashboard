export const dynamic = "force-dynamic";

import { getSettings, getConnectorHealth, getMetrics, getEvents } from "@/lib/api";
import { DashboardClient } from "@/components/DashboardClient";

export default async function Home() {
  const [settings, health, metrics, events] = await Promise.all([
    getSettings(),
    getConnectorHealth(),
    getMetrics(),
    getEvents(),
  ]);

  return (
    <DashboardClient
      settings={settings}
      initialHealth={health}
      initialMetrics={metrics}
      initialEvents={events}
    />
  );
}
