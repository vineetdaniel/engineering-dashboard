"use client";

import { useMemo } from "react";
import { Clock, Eye, Radio, AlertCircle } from "lucide-react";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { Stat } from "./Stat";
import { TrendChart } from "@/components/TrendChart";

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function minutesBetween(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60));
}

function averageMinutes(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null && !Number.isNaN(v));
  if (!nums.length) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

interface IncidentResponseMetricsProps {
  events: any[];
}

export function IncidentResponseMetrics({ events }: IncidentResponseMetricsProps) {
  const incidents = useMemo(() => events.filter((e) => e.event_type === "incident"), [events]);
  const resolvedIncidents = incidents.filter((e) => e.status === "resolved");

  const metrics = useMemo(() => {
    const mttdValues = incidents.map((e) => {
      const started = parseDate(e.happened_at);
      const detected = parseDate(e.meta?.detected_at);
      return minutesBetween(started, detected);
    });
    const mttaValues = incidents.map((e) => {
      const detected = parseDate(e.meta?.detected_at);
      const acknowledged = parseDate(e.meta?.acknowledged_at);
      return minutesBetween(detected, acknowledged);
    });
    const mttrValues = resolvedIncidents.map((e) => {
      const started = parseDate(e.happened_at);
      const resolved = parseDate(e.meta?.resolved_at);
      return minutesBetween(started, resolved);
    });

    return {
      mttd: averageMinutes(mttdValues),
      mtta: averageMinutes(mttaValues),
      mttr: averageMinutes(mttrValues),
      unacknowledged: incidents.filter((e) => e.status !== "resolved" && !e.meta?.acknowledged_at).length,
    };
  }, [incidents, resolvedIncidents]);

  const trendData = useMemo(() => {
    const sorted = [...resolvedIncidents]
      .filter((e) => e.meta?.resolved_at)
      .sort((a, b) => new Date(a.meta.resolved_at).getTime() - new Date(b.meta.resolved_at).getTime())
      .slice(-8);
    return sorted.map((e) => {
      const started = parseDate(e.happened_at);
      const resolved = parseDate(e.meta.resolved_at);
      return {
        label: e.entity.slice(0, 4),
        mttr: minutesBetween(started, resolved) ?? 0,
      };
    });
  }, [resolvedIncidents]);

  return (
    <Widget className="space-y-4">
      <WidgetHeader
        title="Incident Response Metrics"
        subtitle="MTTD · MTTA · MTTR over resolved incidents"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          title="MTTD"
          value={metrics.mttd != null ? `${metrics.mttd}m` : "—"}
          icon={Eye}
          variant={metrics.mttd != null && metrics.mttd > 15 ? "warning" : "success"}
          subtext="Mean time to detect"
          target="<10m"
        />
        <Stat
          title="MTTA"
          value={metrics.mtta != null ? `${metrics.mtta}m` : "—"}
          icon={Radio}
          variant={metrics.mtta != null && metrics.mtta > 30 ? "warning" : "success"}
          subtext="Mean time to acknowledge"
          target="<15m"
        />
        <Stat
          title="MTTR"
          value={metrics.mttr != null ? `${metrics.mttr}m` : "—"}
          icon={Clock}
          variant={metrics.mttr != null && metrics.mttr > 60 ? "warning" : "success"}
          subtext="Mean time to resolve"
          target="<60m"
        />
        <Stat
          title="Unacknowledged"
          value={metrics.unacknowledged}
          icon={AlertCircle}
          variant={metrics.unacknowledged > 0 ? "danger" : "success"}
          trendInverse
          target="0"
        />
      </div>

      {trendData.length > 1 && (
        <TrendChart
          title="MTTR Trend"
          subtitle="Minutes per resolved incident"
          data={trendData}
          type="area"
          color="#f59e0b"
          target={60}
          targetLabel="Target <60m"
          className="h-48"
        />
      )}
    </Widget>
  );
}
