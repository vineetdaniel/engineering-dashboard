import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";

export interface DataTableRow {
  id: string | number;
  label: string;
  meta?: string;
  status?: string;
  severity?: "low" | "medium" | "high" | "critical";
  owner?: string;
  date?: string;
  href?: string;
}

interface DataTableProps {
  title: string;
  subtitle?: string;
  rows: DataTableRow[];
  emptyText?: string;
  maxRows?: number;
  className?: string;
  dataSource?: "live" | "seed" | "mixed" | "dummy";
}

export function DataTable({
  title,
  subtitle,
  rows,
  emptyText = "No items to display",
  maxRows,
  className,
  dataSource,
}: DataTableProps) {
  const visibleRows = maxRows ? rows.slice(0, maxRows) : rows;

  return (
    <Widget className={cn("flex flex-col", className)} dataSource={dataSource}>
      <WidgetHeader title={title} subtitle={subtitle} badge={rows.length > 0 ? rows.length : undefined} dataSource={dataSource} />
      <div className="-mx-5 flex-1 overflow-x-auto">
        {rows.length === 0 ? (
          <div className="flex h-40 items-center justify-center px-5">
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          </div>
        ) : (
          <table className="w-full min-w-[440px] text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <th className="px-5 py-2">Item</th>
                <th className="px-5 py-2">Status</th>
                <th className="px-5 py-2 text-right">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleRows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "group transition-colors hover:bg-muted/50",
                    row.href && "cursor-pointer"
                  )}
                >
                  <td className="px-5 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground truncate max-w-[240px] sm:max-w-xs">
                        {row.label}
                      </span>
                      {(row.meta || row.owner || row.date) && (
                        <span className="mt-0.5 truncate text-xs text-muted-foreground">
                          {[row.meta, row.owner, row.date].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {row.status && (
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                        {row.status}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {row.severity && <SeverityBadge level={row.severity} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Widget>
  );
}

function SeverityBadge({ level }: { level: string }) {
  const map: Record<
    string,
    { variant: React.ComponentProps<typeof Badge>["variant"]; label: string }
  > = {
    low: { variant: "secondary", label: "Low" },
    medium: { variant: "info", label: "Med" },
    high: { variant: "warning", label: "High" },
    critical: { variant: "danger", label: "Critical" },
  };
  const v = map[level] || { variant: "secondary", label: level };
  return <Badge variant={v.variant}>{v.label}</Badge>;
}
