import { DashboardShell } from "@/components/DashboardShell";
import { PersonasClient } from "@/components/planning/PersonasClient";

export const dynamic = "force-dynamic";

export default function PersonasPage() {
  return (
    <DashboardShell activeSection="planning">
      <PersonasClient />
    </DashboardShell>
  );
}
