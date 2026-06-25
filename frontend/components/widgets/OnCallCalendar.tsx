"use client";

import { Calendar, Clock, User } from "lucide-react";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { cn } from "@/lib/utils";

interface OnCallCalendarProps {
  className?: string;
}

const SQUADS = ["platform", "payments", "risk", "data"];
const PEOPLE = ["Alex", "Priya", "Jordan", "Sam", "Casey", "Taylor"];

function seedRotation(squad: string, offset: number) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekStart = new Date(start);
  weekStart.setDate(start.getDate() + offset * 7);
  const primary = PEOPLE[(offset + SQUADS.indexOf(squad)) % PEOPLE.length];
  const secondary = PEOPLE[(offset + SQUADS.indexOf(squad) + 2) % PEOPLE.length];
  return { primary, secondary, weekStart };
}

export function OnCallCalendar({ className }: OnCallCalendarProps) {
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const rotations = SQUADS.map((squad) => seedRotation(squad, i));
    return { index: i, rotations };
  });

  return (
    <Widget className={cn("space-y-4", className)}>
      <WidgetHeader title="On-Call Calendar" subtitle="Primary / secondary rotation by squad" />
      <div className="space-y-3">
        {weeks.map((week) => {
          const start = week.rotations[0].weekStart;
          const end = new Date(start);
          end.setDate(start.getDate() + 6);
          return (
            <div key={week.index} className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
                <Calendar size={14} className="text-muted-foreground" />
                {start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} —{" "}
                {end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                {week.index === 0 && (
                  <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">Current</span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {week.rotations.map((rot) => (
                  <div
                    key={rot.weekStart.toISOString() + SQUADS[week.rotations.indexOf(rot)]}
                    className="flex items-center justify-between rounded-lg bg-card px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {SQUADS[week.rotations.indexOf(rot)]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 dark:bg-indigo-950">
                        <User size={10} className="text-indigo-600 dark:text-indigo-300" />
                        <span className="font-medium text-indigo-700 dark:text-indigo-300">{rot.primary}</span>
                      </div>
                      <div className="flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                        <Clock size={10} className="text-slate-500" />
                        <span className="font-medium text-slate-700 dark:text-slate-300">{rot.secondary}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}
