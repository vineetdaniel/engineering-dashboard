import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface WidgetHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string | number;
  badgeVariant?: React.ComponentProps<typeof Badge>["variant"];
  action?: React.ReactNode;
  className?: string;
  lastUpdated?: Date | null;
  dataSource?: "live" | "seed" | "mixed" | "dummy";
}

function formatAge(date?: Date | null) {
  if (!date) return null;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function sourceBadge(source?: WidgetHeaderProps["dataSource"]) {
  if (!source || source === "live") return null;
  const map: Record<Exclude<WidgetHeaderProps["dataSource"], undefined | "live">, { label: string; class: string }> = {
    seed: { label: "Seed data", class: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300" },
    mixed: { label: "Mixed data", class: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300" },
    dummy: { label: "Demo", class: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300" },
  };
  const { label, class: className } = map[source];
  return <span className={cn("rounded-md border px-1.5 py-0 text-[10px] font-medium", className)}>{label}</span>;
}

export function WidgetHeader({
  title,
  subtitle,
  badge,
  badgeVariant = "secondary",
  action,
  className,
  lastUpdated,
  dataSource,
}: WidgetHeaderProps) {
  const age = formatAge(lastUpdated);
  return (
    <div className={cn("flex items-start justify-between gap-4 pb-4", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold leading-none tracking-tight text-foreground">{title}</h3>
          {badge !== undefined && (
            <Badge variant={badgeVariant} className="text-[10px] px-1.5 py-0">
              {badge}
            </Badge>
          )}
          {sourceBadge(dataSource)}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {subtitle && <p className="text-sm font-medium text-muted-foreground">{subtitle}</p>}
          {age && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              </span>
              {age}
            </span>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
