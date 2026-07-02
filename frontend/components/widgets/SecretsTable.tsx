"use client";

import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { DataTable, type DataTableRow } from "./DataTable";
import { cn } from "@/lib/utils";

export interface SecretFindingRow {
  id: string | number;
  label: string;
  repo?: string;
  secret_type?: string;
  status?: string;
  severity?: "low" | "medium" | "high" | "critical";
  created_at?: string;
  url?: string;
}

interface SecretsTableProps {
  events: any[];
  title?: string;
  subtitle?: string;
  dataSource?: "live" | "seed" | "mixed" | "dummy";
  maxRows?: number;
}

export function SecretsTable({
  events,
  title = "Secret Scanning Alerts",
  subtitle = "Exposed secrets detected by GitHub",
  dataSource,
  maxRows = 8,
}: SecretsTableProps) {
  const rows: DataTableRow[] = events
    .filter((e) => e.event_type === "secret_scanning_alert")
    .slice(0, maxRows)
    .map((e) => ({
      id: e.id,
      label: e.title || e.meta?.secret_type || "Unknown secret",
      meta: e.entity || e.repo,
      status: e.status || e.meta?.status,
      severity: e.severity === "critical" ? "critical" : e.severity === "high" ? "high" : "medium",
    }));

  return (
    <DataTable
      title={title}
      subtitle={subtitle}
      rows={rows}
      dataSource={dataSource}
      maxRows={maxRows}
      emptyText="No secret scanning alerts — great hygiene!"
    />
  );
}
