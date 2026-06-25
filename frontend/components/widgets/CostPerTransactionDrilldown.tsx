"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";

interface CostPerTransactionDrilldownProps {
  metrics: any[];
}

function formatShortDate(timestamp: string | null | undefined) {
  if (!timestamp) return "";
  try {
    return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function CostPerTransactionDrilldown({ metrics }: CostPerTransactionDrilldownProps) {
  const data = useMemo(() => {
    const costs = metrics
      .filter((m) => m.metric_type === "cost_per_transaction")
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 12)
      .map((m) => ({ value: m.value ?? 0, timestamp: m.timestamp }));

    const volumes = metrics
      .filter((m) => m.metric_type === "transaction_volume")
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 12)
      .map((m) => ({ value: (m.value ?? 0) / 1_000_000, timestamp: m.timestamp }));

    const len = Math.min(costs.length, volumes.length);
    if (len === 0) return [];

    return Array.from({ length: len }, (_, i) => ({
      label: formatShortDate(costs[i].timestamp || volumes[i].timestamp) || `D${i + 1}`,
      cost: costs[i].value,
      volume: volumes[i].value,
    })).reverse();
  }, [metrics]);

  const latest = data[data.length - 1];
  const targetCost = 0.005;

  if (!latest) {
    return (
      <Widget className="flex flex-col">
        <WidgetHeader
          title="Cost Per Transaction Drilldown"
          subtitle="AWS MTD spend ÷ daily transaction volume from Datadog / New Relic"
        />
        <div className="flex flex-1 items-center justify-center min-h-[220px]">
          <p className="text-sm text-muted-foreground">No cost-per-transaction data available.</p>
        </div>
      </Widget>
    );
  }

  const impliedDailyCost = latest.cost * latest.volume * 1_000_000;

  return (
    <Widget className="flex flex-col">
      <WidgetHeader
        title="Cost Per Transaction Drilldown"
        subtitle="AWS MTD spend ÷ daily transaction volume from Datadog / New Relic"
      />

      <div className="grid grid-cols-3 gap-3 px-5 pt-1">
        <div className="rounded-lg border border-border/60 bg-muted/40 p-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Latest Cost / Txn
          </p>
          <p className="mt-0.5 text-lg font-bold text-foreground">${latest.cost.toFixed(4)}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/40 p-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Volume Today
          </p>
          <p className="mt-0.5 text-lg font-bold text-foreground">
            {latest.volume.toFixed(2)}M
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/40 p-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Implied Daily Cost
          </p>
          <p className="mt-0.5 text-lg font-bold text-foreground">
            ${impliedDailyCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      <div className="min-h-[220px] flex-1 px-2 pb-2">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <defs>
                <linearGradient id="costVolumeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v.toFixed(3)}`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v.toFixed(1)}M`}
              />
              <Tooltip content={<DrilldownTooltip />} />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="volume"
                name="Volume (M)"
                stroke="#0ea5e9"
                strokeWidth={2}
                fill="url(#costVolumeFill)"
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="cost"
                name="Cost / txn"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={0}
              />
              <ReferenceLine
                yAxisId="left"
                y={targetCost}
                stroke="hsl(var(--warning))"
                strokeDasharray="4 4"
                label={{ value: "Target <$0.005", position: "insideTopRight", fontSize: 10, fill: "hsl(var(--warning))" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-muted-foreground">No cost-per-transaction data available.</p>
          </div>
        )}
      </div>
    </Widget>
  );
}

function DrilldownTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover p-2 shadow-drop">
      <p className="mb-1 text-xs font-medium text-popover-foreground">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-popover-foreground">
            {entry.dataKey === "cost" ? `$${Number(entry.value).toFixed(5)}` : `${Number(entry.value).toFixed(2)}M`}
          </span>
        </div>
      ))}
    </div>
  );
}
