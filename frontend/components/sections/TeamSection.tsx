"use client";

import { Users, TrendingUp, CalendarDays, Briefcase } from "lucide-react";
import { SectionProps } from "./types";
import { SectionHeader } from "./SectionHeader";
import { Stat } from "@/components/widgets/Stat";
import { ProgressList } from "@/components/widgets/ProgressList";
import { Timeline } from "@/components/widgets/Timeline";
import { OnCallRotation } from "@/components/widgets/OnCallRotation";
import { OnCallCalendar } from "@/components/widgets/OnCallCalendar";
import { CapacityPlanning } from "@/components/widgets/CapacityPlanning";
import type { ProgressItem } from "@/components/widgets/ProgressList";
import type { TimelineEvent } from "@/components/widgets/Timeline";

export function TeamSection({ metrics, events, lastUpdated, dataSource }: SectionProps) {
  const onCallLoad = metrics.find((m) => m.metric_type === "oncall_load")?.value;
  const ptoThisWeek = metrics.find((m) => m.metric_type === "pto_this_week")?.value;
  const openRoles = metrics.find((m) => m.metric_type === "open_roles")?.value;
  const hireTime = metrics.find((m) => m.metric_type === "hire_time_days")?.value;

  const hiringEvents = events.filter((e) => e.event_type === "hiring_pipeline");

  const hiringPipeline: ProgressItem[] =
    hiringEvents.length > 0
      ? hiringEvents.slice(0, 6).map((e, i) => ({
          id: e.id,
          label: e.title,
          value: e.meta?.stage_pct ?? [60, 30, 80, 15, 45, 70][i % 6],
          meta: e.entity,
          status: e.status,
          color: ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"][i % 6],
        }))
      : [
          { id: 1, label: "Senior Backend Engineer", value: 60, meta: "Payments", status: "2nd round", color: "#6366f1" },
          { id: 2, label: "Security Engineer", value: 30, meta: "Security", status: "screening", color: "#0ea5e9" },
          { id: 3, label: "SRE", value: 80, meta: "Platform", status: "final", color: "#10b981" },
          { id: 4, label: "Product Designer", value: 15, meta: "Product", status: "sourcing", color: "#f59e0b" },
        ];

  const keyDates: TimelineEvent[] = events
    .filter((e) => e.event_type === "team_event")
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      title: e.title,
      timestamp: e.happened_at || new Date().toISOString(),
      description: e.entity,
    }));

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader title="Team & Talent" description="Capacity, hiring pipeline, and key dates" lastUpdated={lastUpdated} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <OnCallRotation />
        <OnCallCalendar />
      </div>

      <CapacityPlanning metrics={metrics} events={events} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          title="On-Call Load"
          value={onCallLoad ?? "2.4"}
          icon={Users}
          subtext="Incidents / person"
          target="<3"
          variant={onCallLoad != null && onCallLoad > 3 ? "warning" : "default"}
        />
        <Stat
          title="PTO This Week"
          value={ptoThisWeek ?? 3}
          icon={CalendarDays}
          subtext="Engineering team"
        />
        <Stat
          title="Open Roles"
          value={openRoles ?? 4}
          icon={Briefcase}
          variant={openRoles != null && openRoles > 5 ? "warning" : "default"}
          trendInverse
        />
        <Stat
          title="Hire Time"
          value={hireTime != null ? `${hireTime}d` : "21d"}
          trend="down"
          trendLabel="-3d"
          icon={TrendingUp}
          variant="success"
          target="<30d"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ProgressList title="Hiring Pipeline" subtitle="Open roles and stage" items={hiringPipeline} />
        <Timeline
          title="Key Dates"
          subtitle="Starts, reviews, and training"
          events={keyDates}
          emptyText="No upcoming team events"
        />
      </div>
    </div>
  );
}
