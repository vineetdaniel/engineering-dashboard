import type { FilterState } from "@/components/GlobalFilters";

export interface StrategyGoalsData {
  six_month: string;
  quarterly: string;
  weekly: string;
  ai_strategy_focus: string;
  top_risks: string;
  growth_levers: string;
  team_capacity_notes: string;
}

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
  healthLoading?: boolean;
  strategyGoals?: { goals: StrategyGoalsData; updated_at: string | null } | null;
  onStrategyRefresh?: () => void;
}
