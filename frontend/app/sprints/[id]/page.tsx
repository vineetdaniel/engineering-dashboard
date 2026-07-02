import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { SprintDetailClient } from "@/components/planning/SprintDetailClient";
import { getSprint, listActiveResourcesByTeam } from "@/lib/actions/sprints";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SprintDetailPage({ params }: PageProps) {
  const { id } = await params;
  const sprintId = Number(id);
  if (Number.isNaN(sprintId)) return notFound();

  const [sprintResult, resourcesResult] = await Promise.all([
    getSprint(sprintId),
    listActiveResourcesByTeam(),
  ]);

  if (sprintResult.error || !sprintResult.data) return notFound();

  const allResources = Object.values(resourcesResult.data || {}).flat();

  return (
    <DashboardShell activeSection="planning">
      <SprintDetailClient initialSprint={sprintResult.data} resources={allResources} />
    </DashboardShell>
  );
}
