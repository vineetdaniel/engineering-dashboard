import { cn } from "@/lib/utils";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";

export interface DeveloperPointsRow {
  login: string;
  name: string;
  points: number;
  issueCount: number;
  project?: string;
}

interface DeveloperPointsTableProps {
  rows: DeveloperPointsRow[];
  title?: string;
  subtitle?: string;
  emptyText?: string;
  maxRows?: number;
  className?: string;
  dataSource?: "live" | "seed" | "mixed" | "dummy";
}

export function DeveloperPointsTable({
  rows,
  title = "Developer Open Story Points",
  subtitle,
  emptyText = "No developers with open story points",
  maxRows = 6,
  className,
  dataSource,
}: DeveloperPointsTableProps) {
  const visible = maxRows ? rows.slice(0, maxRows) : rows;
  const totalPoints = rows.reduce((sum, r) => sum + r.points, 0);
  const totalIssues = rows.reduce((sum, r) => sum + r.issueCount, 0);

  return (
    <Widget className={cn("flex flex-col", className)} dataSource={dataSource}>
      <WidgetHeader
        title={title}
        subtitle={subtitle || `${totalPoints} pts · ${totalIssues} issues`}
        badge={rows.length > 0 ? rows.length : undefined}
        dataSource={dataSource}
      />
      <div className="-mx-5 flex-1 overflow-x-auto">
        {rows.length === 0 ? (
          <div className="flex h-40 items-center justify-center px-5">
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          </div>
        ) : (
          <table className="w-full min-w-[280px] text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <th className="px-5 py-2">Developer</th>
                <th className="px-5 py-2 text-right">Open Pts</th>
                <th className="px-5 py-2 text-right">Issues</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((dev) => (
                <tr key={dev.login} className="transition-colors hover:bg-muted/50">
                  <td className="px-5 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{dev.name || dev.login}</span>
                      {dev.name && dev.name !== dev.login && (
                        <span className="text-xs text-muted-foreground">@{dev.login}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-foreground">{dev.points}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground">{dev.issueCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Widget>
  );
}
