import { cn } from "@/lib/utils";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";

export interface TopDeveloper {
  login: string;
  name: string;
  count: number;
  repos: string[];
}

interface TopDevelopersProps {
  developers: TopDeveloper[];
  emptyText?: string;
  maxRows?: number;
  className?: string;
  dataSource?: "live" | "seed" | "mixed" | "dummy";
  subtitle?: string;
}

export function TopDevelopers({
  developers,
  emptyText = "No commits in this range",
  maxRows = 5,
  className,
  dataSource,
  subtitle,
}: TopDevelopersProps) {
  const visible = maxRows ? developers.slice(0, maxRows) : developers;

  return (
    <Widget dataSource={dataSource} className={cn("flex flex-col", className)}>
      <WidgetHeader title="Top Developers" subtitle={subtitle || "By commit count"} badge={developers.length || undefined} dataSource={dataSource} />
      <div className="-mx-5 flex-1 overflow-x-auto">
        {developers.length === 0 ? (
          <div className="flex h-40 items-center justify-center px-5">
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          </div>
        ) : (
          <table className="w-full min-w-[280px] text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <th className="px-5 py-2">Developer</th>
                <th className="px-5 py-2 text-right">Commits</th>
                <th className="px-5 py-2 text-right">Repos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((dev, index) => (
                <tr key={dev.login} className="transition-colors hover:bg-muted/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-foreground truncate max-w-[180px]">
                          {dev.name || dev.login}
                        </span>
                        {dev.name && dev.name !== dev.login && (
                          <span className="text-xs text-muted-foreground truncate">@{dev.login}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-foreground">{dev.count}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground">{dev.repos.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Widget>
  );
}
