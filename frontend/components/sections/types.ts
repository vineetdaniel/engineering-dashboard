import type { FilterState } from "@/components/GlobalFilters";

export interface SectionProps {
  settings: any;
  health: any;
  metrics: any[];
  events: any[];
  dataSource?: "live" | "seed" | "mixed" | "dummy";
  data: {
    openPRs: number;
    openIssues: number;
    openBugs: number;
    stuckPRs: any[];
    blocked: any[];
    cves: any[];
    criticalCount: number;
    activeIncidents: any[];
    p0p1Incidents: any[];
  };
  filters: FilterState;
  onSync: (source: string) => void;
  syncLoading: string | null;
  lastUpdated?: Date | null;
  lastSyncResult?: { source: string; metrics: number; events: number } | null;
}
