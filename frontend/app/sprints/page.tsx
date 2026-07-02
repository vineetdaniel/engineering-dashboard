import { DashboardShell } from "@/components/DashboardShell";
import { SprintListClient } from "@/components/planning/SprintListClient";
import { listSprints } from "@/lib/actions/sprints";

export const dynamic = "force-dynamic";

export default async function SprintsPage() {
  const result = await listSprints("all");
  return (
    <DashboardShell activeSection="planning">
      <SprintListClient initialSprints={result.data || []} />
    </DashboardShell>
  );
}
