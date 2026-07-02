"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";

type ChartType = "area" | "bar" | "composed";

export interface TrendChartSeries {
  key: string;
  label: string;
  color?: string;
  type?: "area" | "bar";
}

export interface TrendChartProps {
  title: string;
  subtitle?: string;
  data: Record<string, string | number>[];
  type?: ChartType;
  series?: TrendChartSeries[];
  /** Single-series shorthand. */
  color?: string;
  dataKey?: string;
  xAxisKey?: string;
  target?: number;
  targetLabel?: string;
  badge?: string | number;
  className?: string;
  emptyText?: string;
  dataSource?: "live" | "seed" | "mixed" | "dummy";
}

export function TrendChart({
  title,
  subtitle,
  data,
  type = "area",
  series,
  color = "#6366f1",
  dataKey = "value",
  xAxisKey = "label",
  target,
  targetLabel = "Target",
  badge,
  className,
  emptyText = "No data available",
  dataSource,
}: TrendChartProps) {
  const resolvedSeries = series
    ? series.map((s) => ({ ...s, color: s.color || color, type: s.type || (type === "composed" ? "area" : (type as "area" | "bar")) }))
    : [{ key: dataKey, label: title, color, type: type === "bar" ? "bar" : "area" }];

  const hasBars = resolvedSeries.some((s) => s.type === "bar");
  const hasAreas = resolvedSeries.some((s) => s.type === "area");
  const isComposed = hasBars && hasAreas;

  const noData = !data.length;

  return (
    <Widget className={cn("flex flex-col", className)}>
      <WidgetHeader title={title} subtitle={subtitle} badge={badge} dataSource={dataSource} />
      <div className="flex-1 min-h-[200px] sm:min-h-[240px]">
        {noData ? (
          <div className="flex h-48 sm:h-60 items-center justify-center">
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          </div>
        ) : resolvedSeries.every((s) => s.type === "bar") ? (
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              {resolvedSeries.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} />
              ))}
              {target !== undefined && <ReferenceLine y={target} stroke="hsl(var(--warning))" strokeDasharray="4 4" label={targetLabel} />}
            </BarChart>
          </ResponsiveContainer>
        ) : isComposed ? (
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -12 }}>
              <defs>
                {resolvedSeries
                  .filter((s) => s.type === "area")
                  .map((s) => (
                    <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              {resolvedSeries.length > 1 && <Legend iconType="circle" />}
              {resolvedSeries.map((s) =>
                s.type === "bar" ? (
                  <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} />
                ) : (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill={`url(#grad-${s.key})`}
                  />
                )
              )}
              {target !== undefined && <ReferenceLine y={target} stroke="hsl(var(--warning))" strokeDasharray="4 4" label={targetLabel} />}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -12 }}>
              <defs>
                {resolvedSeries.map((s) => (
                  <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              {resolvedSeries.length > 1 && <Legend iconType="circle" />}
              {resolvedSeries.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill={`url(#grad-${s.key})`}
                />
              ))}
              {target !== undefined && <ReferenceLine y={target} stroke="hsl(var(--warning))" strokeDasharray="4 4" label={targetLabel} />}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Widget>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover p-2 shadow-drop">
      <p className="mb-1 text-xs font-medium text-popover-foreground">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-popover-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}
