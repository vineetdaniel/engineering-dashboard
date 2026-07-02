import { DashboardShell } from "@/components/DashboardShell";
import { ResourceManagerClient } from "@/components/planning/ResourceManagerClient";
import { listResources } from "@/lib/actions/resources";

export const dynamic = "force-dynamic";

export default async function ResourcesPage() {
  const result = await listResources();
  return (
    <DashboardShell activeSection="planning">
      <ResourceManagerClient initialResources={result.data || []} />
    </DashboardShell>
  );
}
