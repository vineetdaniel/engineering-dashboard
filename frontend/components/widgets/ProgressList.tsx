import { cn } from "@/lib/utils";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";

export interface ProgressItem {
  id: string | number;
  label: string;
  value: number; // 0-100
  meta?: string;
  owner?: string;
  status?: string;
  color?: string;
}

interface ProgressListProps {
  title: string;
  subtitle?: string;
  items: ProgressItem[];
  emptyText?: string;
  maxItems?: number;
  className?: string;
}

export function ProgressList({
  title,
  subtitle,
  items,
  emptyText = "No items to display",
  maxItems,
  className,
}: ProgressListProps) {
  const visibleItems = maxItems ? items.slice(0, maxItems) : items;

  return (
    <Widget className={cn("flex flex-col", className)}>
      <WidgetHeader title={title} subtitle={subtitle} badge={items.length > 0 ? items.length : undefined} />
      <div className="flex-1 overflow-auto space-y-4">
        {items.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          </div>
        ) : (
          visibleItems.map((item) => (
            <div key={item.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{item.label}</p>
                  {(item.meta || item.owner || item.status) && (
                    <p className="truncate text-xs text-muted-foreground">
                      {[item.meta, item.owner, item.status].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-semibold text-foreground">{item.value}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(0, Math.min(100, item.value))}%`,
                    backgroundColor: item.color || "#6366f1",
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </Widget>
  );
}
