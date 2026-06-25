import { cn } from "@/lib/utils";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { Badge } from "@/components/ui/badge";

export interface PullRequestRow {
  id: string | number;
  title: string;
  repo?: string;
  author?: string;
  reviewers?: string[];
  mergedBy?: string;
  status?: "open" | "closed" | "merged" | string;
  createdAt?: string;
  branch?: string;
  baseBranch?: string;
  url?: string;
}

interface PullRequestsTableProps {
  rows: PullRequestRow[];
  title?: string;
  subtitle?: string;
  emptyText?: string;
  maxRows?: number;
  className?: string;
  dataSource?: "live" | "seed" | "mixed" | "dummy";
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function statusConfig(status?: string) {
  switch (status) {
    case "merged":
      return "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300";
    case "open":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";
    case "closed":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
  }
}

export function PullRequestsTable({
  rows,
  title = "Pull Requests",
  subtitle = "Raised, reviewed, and merged",
  emptyText = "No pull requests in this range",
  maxRows = 8,
  className,
  dataSource,
}: PullRequestsTableProps) {
  const visible = maxRows ? rows.slice(0, maxRows) : rows;

  return (
    <Widget className={cn("flex flex-col", className)} dataSource={dataSource}>
      <WidgetHeader
        title={title}
        subtitle={subtitle}
        badge={rows.length > 0 ? rows.length : undefined}
        dataSource={dataSource}
      />
      <div className="-mx-5 flex-1 overflow-x-auto">
        {rows.length === 0 ? (
          <div className="flex h-40 items-center justify-center px-5">
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          </div>
        ) : (
          <table className="w-full min-w-[520px] text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <th className="px-5 py-2">PR</th>
                <th className="px-5 py-2">Author</th>
                <th className="px-5 py-2">Reviewer(s)</th>
                <th className="px-5 py-2">Merged by</th>
                <th className="px-5 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-5 py-3">
                    <div className="flex flex-col min-w-0">
                      {row.url ? (
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-foreground truncate max-w-[260px] hover:text-indigo-600 dark:hover:text-indigo-400"
                        >
                          {row.title}
                        </a>
                      ) : (
                        <span className="font-medium text-foreground truncate max-w-[260px]">
                          {row.title}
                        </span>
                      )}
                      <span className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[row.repo, row.branch, timeAgo(row.createdAt)].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                      {row.author || "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {row.reviewers && row.reviewers.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {row.reviewers.slice(0, 3).map((r) => (
                          <span
                            key={r}
                            className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          >
                            {r}
                          </span>
                        ))}
                        {row.reviewers.length > 3 && (
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            +{row.reviewers.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {row.mergedBy ? (
                      <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                        {row.mergedBy}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] capitalize", statusConfig(row.status))}
                    >
                      {row.status || "—"}
                    </Badge>
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
