"use client";

import { useMemo } from "react";
import { Users, TrendingUp, CalendarDays, Briefcase, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { Stat } from "./Stat";
import { TrendChart } from "@/components/TrendChart";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface CapacityPlanningProps {
  metrics: any[];
  events: any[];
}

export function CapacityPlanning({ metrics, events }: CapacityPlanningProps) {
  const headcountBySquad = useMemo(() => {
    const squads = ["platform", "payments", "risk", "data"];
    return squads.map((squad) => {
      const current = metrics
        .filter((m) => m.metric_type === "headcount" && (m.entity === squad || m.meta?.squad === squad))
        .slice(0, 1)[0]?.value ?? 8;
      const target = metrics
        .filter((m) => m.metric_type === "headcount_target" && (m.entity === squad || m.meta?.squad === squad))
        .slice(0, 1)[0]?.value ?? current + 2;
      const openRoles = metrics
        .filter((m) => m.metric_type === "open_roles" && (m.entity === squad || m.meta?.squad === squad))
        .slice(0, 1)[0]?.value ?? 0;
      const utilization = metrics
        .filter((m) => m.metric_type === "squad_utilization" && (m.entity === squad || m.meta?.squad === squad))
        .slice(0, 1)[0]?.value ?? 85;
      return { squad, current, target, openRoles, utilization };
    });
  }, [metrics]);

  const utilizationSeries = metrics
    .filter((m) => m.metric_type === "squad_utilization")
    .slice(0, 8)
    .map((m, i) => ({ label: `W${i + 1}`, value: m.value ?? 0 }));

  const ptoEvents = events.filter((e) => e.event_type === "team_event" && e.title.includes("PTO"));
  const onboardingEvents = events.filter((e) => e.event_type === "team_event" && e.title.includes("Onboarding"));

  const totalCurrent = headcountBySquad.reduce((a, s) => a + s.current, 0);
  const totalTarget = headcountBySquad.reduce((a, s) => a + s.target, 0);
  const totalOpen = headcountBySquad.reduce((a, s) => a + s.openRoles, 0);
  const avgUtilization = headcountBySquad.length
    ? Math.round(headcountBySquad.reduce((a, s) => a + s.utilization, 0) / headcountBySquad.length)
    : 0;

  return (
    <Widget className="space-y-4">
      <WidgetHeader
        title="Capacity Planning"
        subtitle="Headcount, utilization, and hiring gaps by squad"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          title="Current Headcount"
          value={totalCurrent}
          icon={Users}
          subtext="Engineering"
        />
        <Stat
          title="Target Headcount"
          value={totalTarget}
          icon={TrendingUp}
          subtext="Planned"
        />
        <Stat
          title="Open Roles"
          value={totalOpen}
          icon={Briefcase}
          variant={totalOpen > 6 ? "warning" : "default"}
          trendInverse
        />
        <Stat
          title="Avg Utilization"
          value={`${avgUtilization}%`}
          icon={CalendarDays}
          variant={avgUtilization > 90 ? "warning" : avgUtilization < 60 ? "warning" : "success"}
          target="70-90%"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {headcountBySquad.map((s) => {
            const pct = s.target > 0 ? Math.round((s.current / s.target) * 100) : 0;
            const shortfall = Math.max(0, s.target - s.current);
            return (
              <div key={s.squad} className="rounded-xl border border-border bg-muted/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold uppercase tracking-wider text-foreground">{s.squad}</span>
                  <span className="text-xs text-muted-foreground">{s.current}/{s.target}</span>
                </div>
                <Progress value={pct} className="mt-2 h-2" />
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Utilization {s.utilization}%</span>
                  {shortfall > 0 && (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <AlertTriangle size={10} />
                      {shortfall} open roles
                    </span>
                  )}
                  {shortfall === 0 && (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={10} />
                      Fully staffed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <TrendChart
          title="Squad Utilization Trend"
          subtitle="Weekly average utilization %"
          data={utilizationSeries.length > 1 ? utilizationSeries : [
            { label: "W1", value: 78 },
            { label: "W2", value: 82 },
            { label: "W3", value: 85 },
            { label: "W4", value: 88 },
            { label: "W5", value: 86 },
          ]}
          type="area"
          color="#8b5cf6"
          target={90}
          targetLabel="Max target"
          className="h-64"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 text-center text-xs">
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-muted-foreground">PTO this week</p>
          <p className="text-lg font-bold text-foreground">{ptoEvents.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-muted-foreground">Onboarding</p>
          <p className="text-lg font-bold text-foreground">{onboardingEvents.length}</p>
        </div>
      </div>
    </Widget>
  );
}
