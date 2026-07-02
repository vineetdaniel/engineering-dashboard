"use client";

import { CalendarDays, Users, Server } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterState = {
  dateRange: "24h" | "7d" | "30d" | "90d";
  squad: "all" | "platform" | "payments" | "data" | "security";
  environment: "all" | "prod" | "staging";
};

const dateRanges: { value: FilterState["dateRange"]; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

const squads: { value: FilterState["squad"]; label: string }[] = [
  { value: "all", label: "All squads" },
  { value: "platform", label: "Platform" },
  { value: "payments", label: "Payments" },
  { value: "data", label: "Data" },
  { value: "security", label: "Security" },
];

const environments: { value: FilterState["environment"]; label: string }[] = [
  { value: "all", label: "All envs" },
  { value: "prod", label: "Production" },
  { value: "staging", label: "Staging" },
];

interface GlobalFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  className?: string;
}

export function GlobalFilters({ filters, onChange, className }: GlobalFiltersProps) {
  function update<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card/80 p-1 shadow-sm backdrop-blur-md",
        className
      )}
    >
      <FilterGroup icon={CalendarDays} label="Range">
        {dateRanges.map((range) => (
          <button
            key={range.value}
            onClick={() => update("dateRange", range.value)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-medium transition",
              filters.dateRange === range.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {range.label}
          </button>
        ))}
      </FilterGroup>

      <span className="hidden h-4 w-px bg-border sm:block" />

      <FilterGroup icon={Users} label="Squad">
        {squads.map((squad) => (
          <button
            key={squad.value}
            onClick={() => update("squad", squad.value)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-medium transition",
              filters.squad === squad.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {squad.label}
          </button>
        ))}
      </FilterGroup>

      <span className="hidden h-4 w-px bg-border sm:block" />

      <FilterGroup icon={Server} label="Env">
        {environments.map((env) => (
          <button
            key={env.value}
            onClick={() => update("environment", env.value)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-medium transition",
              filters.environment === env.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {env.label}
          </button>
        ))}
      </FilterGroup>
    </div>
  );
}

function FilterGroup({
  children,
  icon: Icon,
  label,
}: {
  children: React.ReactNode;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="sr-only">{label}</span>
      <Icon size={14} className="ml-1 text-muted-foreground" />
      {children}
    </div>
  );
}
