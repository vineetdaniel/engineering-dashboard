import { cn } from "@/lib/utils";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";

export interface SprintDeveloperRow {
  sprint: string;
  developer: string;
  login?: string;
  points: number;
  completedPoints: number;
  project?: string;
}

interface SprintDeveloperPointsProps {
  rows: SprintDeveloperRow[];
  title?: string;
  subtitle?: string;
  emptyText?: string;
  maxRows?: number;
  className?: string;
  dataSource?: "live" | "seed" | "mixed" | "dummy";
}

export function SprintDeveloperPoints({
  rows,
  title = "Sprint Points per Developer",
  subtitle,
  emptyText = "No sprint developer data available",
  maxRows = 8,
  className,
  dataSource,
}: SprintDeveloperPointsProps) {
  const visible = maxRows ? rows.slice(0, maxRows) : rows;
  const totalPoints = rows.reduce((sum, r) => sum + r.points, 0);
  const uniqueSprints = new Set(rows.map((r) => r.sprint)).size;

  return (
    <Widget className={cn("flex flex-col", className)} dataSource={dataSource}>
      <WidgetHeader
        title={title}
        subtitle={subtitle || `${totalPoints} pts · ${uniqueSprints} sprint${uniqueSprints === 1 ? "" : "s"}`}
        badge={rows.length > 0 ? rows.length : undefined}
        dataSource={dataSource}
      />
      <div className="-mx-5 flex-1 overflow-x-auto">
        {rows.length === 0 ? (
          <div className="flex h-40 items-center justify-center px-5">
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          </div>
        ) : (
          <table className="w-full min-w-[340px] text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <th className="px-5 py-2">Sprint · Developer</th>
                <th className="px-5 py-2 text-right">Points</th>
                <th className="px-5 py-2 text-right">Done</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((row, index) => {
                const pct = row.points > 0 ? Math.round((row.completedPoints / row.points) * 100) : 0;
                return (
                  <tr key={`${row.sprint}-${row.login || row.developer}-${index}`} className="transition-colors hover:bg-muted/50">
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-muted-foreground">{row.sprint}</span>
                        <span className="font-medium text-foreground">{row.developer}</span>
                        {row.login && row.login !== row.developer && (
                          <span className="text-xs text-muted-foreground">@{row.login}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">{row.points}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-xs text-muted-foreground">
                        {row.completedPoints} ({pct}%)
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Widget>
  );
}
