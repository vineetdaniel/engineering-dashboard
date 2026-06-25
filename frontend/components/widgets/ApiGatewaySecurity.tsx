"use client";

import { useMemo } from "react";
import { Shield, Ban, Activity, Globe } from "lucide-react";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { Stat } from "./Stat";
import { TrendChart } from "@/components/TrendChart";
import { DataTable } from "@/components/widgets/DataTable";
import type { DataTableRow } from "@/components/widgets/DataTable";

interface ApiGatewaySecurityProps {
  metrics: any[];
  events: any[];
}

export function ApiGatewaySecurity({ metrics, events }: ApiGatewaySecurityProps) {
  const totalRequests = metrics.find((m) => m.metric_type === "api_total_requests")?.value ?? 0;
  const blockedRequests = metrics.find((m) => m.metric_type === "api_blocked_requests")?.value ?? 0;
  const rateLimited = metrics.find((m) => m.metric_type === "api_rate_limited")?.value ?? 0;
  const abuseScore = metrics.find((m) => m.metric_type === "api_abuse_score")?.value ?? 0;

  const blockedSeries = metrics
    .filter((m) => m.metric_type === "api_blocked_requests")
    .slice(0, 8)
    .map((m, i) => ({ label: `D${i + 1}`, value: m.value ?? 0 }));

  const rateLimitedSeries = metrics
    .filter((m) => m.metric_type === "api_rate_limited")
    .slice(0, 8)
    .map((m, i) => ({ label: `D${i + 1}`, value: m.value ?? 0 }));

  const topBlocked: DataTableRow[] = events
    .filter((e) => e.event_type === "api_security_event" && e.meta?.ip)
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      label: e.meta?.ip || "Unknown IP",
      meta: `${e.meta?.reason || e.title} · ${e.meta?.path || e.entity}`,
      status: e.status,
      severity: e.severity === "critical" ? "critical" : e.severity === "high" ? "high" : "medium",
    }));

  const blockedPct = totalRequests > 0 ? (blockedRequests / totalRequests) * 100 : 0;

  return (
    <Widget className="space-y-4">
      <WidgetHeader
        title="API Gateway Security"
        subtitle="Rate limits, abuse signals, and blocked traffic"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          title="Total Requests"
          value={totalRequests > 1000 ? `${(totalRequests / 1000).toFixed(1)}M` : `${totalRequests}`}
          icon={Globe}
          subtext="Last 24h"
        />
        <Stat
          title="Blocked"
          value={blockedRequests.toLocaleString()}
          icon={Ban}
          variant={blockedPct > 1 ? "warning" : "success"}
          subtext={`${blockedPct.toFixed(2)}% of traffic`}
          trendInverse
        />
        <Stat
          title="Rate Limited"
          value={rateLimited.toLocaleString()}
          icon={Activity}
          variant={rateLimited > 1000 ? "warning" : "success"}
          subtext="Legitimate throttles"
        />
        <Stat
          title="Abuse Score"
          value={abuseScore.toFixed(1)}
          icon={Shield}
          variant={abuseScore > 70 ? "danger" : abuseScore > 40 ? "warning" : "success"}
          target="<40"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendChart
          title="Blocked Requests"
          subtitle="Security blocks over time"
          data={blockedSeries.length > 1 ? blockedSeries : [{ label: "Today", value: blockedRequests }]}
          type="bar"
          color="#f43f5e"
          className="h-48"
        />
        <TrendChart
          title="Rate-Limited Requests"
          subtitle="Legitimate throttles over time"
          data={rateLimitedSeries.length > 1 ? rateLimitedSeries : [{ label: "Today", value: rateLimited }]}
          type="bar"
          color="#f59e0b"
          className="h-48"
        />
      </div>

      <DataTable
        title="Top Blocked IPs / Patterns"
        subtitle="Recent API security events"
        rows={topBlocked}
        emptyText="No API security events in selected window"
      />
    </Widget>
  );
}
