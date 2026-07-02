import { DashboardShell } from "@/components/DashboardShell";
import { PersonaDetailClient } from "@/components/planning/PersonaDetailClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ name: string }>;
}

export default async function PersonaDetailPage({ params }: PageProps) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name).replace(/-/g, " ");

  return (
    <DashboardShell activeSection="planning">
      <PersonaDetailClient name={decodedName} />
    </DashboardShell>
  );
}
