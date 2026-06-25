import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";

export interface TimelineEvent {
  id: string | number;
  title: string;
  timestamp: string | Date;
  severity?: "low" | "medium" | "high" | "critical";
  status?: string;
  owner?: string;
  description?: string;
}

interface TimelineProps {
  title?: string;
  subtitle?: string;
  events: TimelineEvent[];
  emptyText?: string;
  maxEvents?: number;
  className?: string;
}

export function Timeline({
  title,
  subtitle,
  events,
  emptyText = "No recent activity",
  maxEvents,
  className,
}: TimelineProps) {
  const visibleEvents = maxEvents ? events.slice(0, maxEvents) : events;

  return (
    <Widget className={cn("flex flex-col", className)}>
      {title && (
        <WidgetHeader title={title} subtitle={subtitle} badge={events.length > 0 ? events.length : undefined} />
      )}
      <div className={cn("flex-1 overflow-auto", !title && "pt-2")}>
        {events.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          </div>
        ) : (
          <ul className="relative space-y-0">
            {visibleEvents.map((event, index) => {
              const color = severityColor(event.severity);
              const isLast = index === visibleEvents.length - 1;
              return (
                <li key={event.id} className="group relative flex gap-4 py-3">
                  {!isLast && (
                    <span className="absolute left-[9px] top-6 bottom-0 w-px bg-border" />
                  )}
                  <div
                    className={cn(
                      "relative z-10 mt-1 h-5 w-5 shrink-0 rounded-full border-2 bg-card",
                      color
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium text-foreground">{event.title}</p>
                      <time className="shrink-0 text-xs text-muted-foreground">
                        {formatTimestamp(event.timestamp)}
                      </time>
                    </div>
                    {(event.description || event.owner || event.status) && (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {[event.status, event.owner, event.description].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Widget>
  );
}

function severityColor(severity?: string) {
  switch (severity) {
    case "critical":
      return "border-rose-500 dark:border-rose-400";
    case "high":
      return "border-amber-500 dark:border-amber-400";
    case "medium":
      return "border-indigo-500 dark:border-indigo-400";
    default:
      return "border-slate-400 dark:border-slate-500";
  }
}

function formatTimestamp(ts: string | Date) {
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return String(ts);
  }
}
