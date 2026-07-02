"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { AlertTriangle, ShieldAlert, GitPullRequest, Zap, Timer, ExternalLink } from "lucide-react";

export interface ActionItem {
  id: string | number;
  type: "cve" | "blocked" | "stuck_pr" | "incident" | "slo";
  title: string;
  meta?: string;
  owner?: string;
  age?: string;
  severity?: "critical" | "high" | "medium" | "low";
  href?: string;
}

interface ActionCenterProps {
  items: ActionItem[];
  maxItems?: number;
  className?: string;
  dataSource?: "live" | "seed" | "mixed" | "dummy";
}

const config: Record<
  ActionItem["type"],
  { label: string; icon: React.ElementType; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  cve: { label: "CVE", icon: ShieldAlert, variant: "danger" },
  blocked: { label: "Blocked", icon: AlertTriangle, variant: "warning" },
  stuck_pr: { label: "Stuck PR", icon: GitPullRequest, variant: "warning" },
  incident: { label: "Incident", icon: Zap, variant: "danger" },
  slo: { label: "SLO", icon: Timer, variant: "warning" },
};

export function ActionCenter({ items, maxItems = 6, className, dataSource }: ActionCenterProps) {
  const visible = maxItems ? items.slice(0, maxItems) : items;

  return (
    <Widget className={cn("flex flex-col", className)} dataSource={dataSource}>
      <WidgetHeader
        title="Action Center"
        subtitle="Items requiring CTO attention"
        badge={items.length > 0 ? items.length : undefined}
        badgeVariant={items.some((i) => i.severity === "critical") ? "danger" : "warning"}
        dataSource={dataSource}
      />
      <div className="flex-1 overflow-auto">
        {items.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-muted-foreground">Nothing needs attention right now.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((item) => {
              const { label, icon: Icon, variant } = config[item.type];
              return (
                <li
                  key={item.id}
                  className="group flex items-start justify-between gap-3 py-3 transition hover:bg-muted/40"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        variant === "danger"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      )}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{item.title}</p>
                      {(item.meta || item.owner || item.age) && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[item.meta, item.owner, item.age].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={variant} className="text-[10px] px-1.5 py-0">
                      {label}
                    </Badge>
                    {item.href && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 transition group-hover:opacity-100"
                        asChild
                      >
                        <a href={item.href} target="_blank" rel="noopener noreferrer" aria-label="Open">
                          <ExternalLink size={14} />
                        </a>
                      </Button>
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
