import { DashboardShell } from "@/components/DashboardShell";
import { ProductivityClient } from "@/components/planning/ProductivityClient";
import { listSprints } from "@/lib/actions/sprints";

export const dynamic = "force-dynamic";

export default async function ProductivityPage() {
  const sprintsResult = await listSprints("all");

  return (
    <DashboardShell activeSection="planning">
      <ProductivityClient sprints={sprintsResult.data || []} />
    </DashboardShell>
  );
}
