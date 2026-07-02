"use client";

import { Phone, ArrowUpRight, Calendar, User } from "lucide-react";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OnCallRotationProps {
  metrics?: any[];
  className?: string;
}

const SQUADS = ["platform", "payments", "risk", "data"];
const ENGINEERS = ["Alex Chen", "Priya Rao", "Jordan Smith", "Sam Lee", "Casey Kim", "Taylor Patel"];

export function OnCallRotation({ className }: OnCallRotationProps) {
  const rotations = SQUADS.map((squad, i) => {
    const primary = ENGINEERS[i % ENGINEERS.length];
    const secondary = ENGINEERS[(i + 1) % ENGINEERS.length];
    return { squad, primary, secondary, week: `Jun ${23 + (i % 4)}–${27 + (i % 4)}` };
  });

  return (
    <Widget className={className}>
      <WidgetHeader
        title="On-Call Rotation"
        subtitle="Current primary and secondary by squad"
        action={
          <Button variant="outline" size="sm" className="gap-1">
            <Calendar size={14} /> Schedule
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rotations.map((r) => (
          <div
            key={r.squad}
            className="rounded-xl border border-border bg-card p-4 transition hover:bg-muted/40"
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold capitalize text-foreground">{r.squad}</p>
              <Badge variant="outline" className="text-[10px] font-semibold border-border bg-muted/70 dark:bg-card">{r.week}</Badge>
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-xs font-bold shadow-sm">
                  {r.primary[0]}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{r.primary}</p>
                  <p className="text-xs font-medium text-muted-foreground">Primary</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-xs font-bold shadow-sm">
                  {r.secondary[0]}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{r.secondary}</p>
                  <p className="text-xs font-medium text-muted-foreground">Secondary</p>
                </div>
              </div>
            </div>

            <Button variant="ghost" size="sm" className="mt-3 w-full gap-1 text-xs">
              <Phone size={12} /> Escalation
              <ArrowUpRight size={12} />
            </Button>
          </div>
        ))}
      </div>
    </Widget>
  );
}
