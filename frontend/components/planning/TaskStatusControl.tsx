"use client";

import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/lib/actions/sprints";

interface TaskStatusControlProps {
  status: TaskStatus;
  onChange: (status: TaskStatus) => void;
}

const statuses: TaskStatus[] = ["todo", "in_progress", "done"];

const labelMap: Record<TaskStatus, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
};

export function TaskStatusControl({ status, onChange }: TaskStatusControlProps) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted p-0.5">
      {statuses.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={cn(
            "rounded-md px-2 py-0.5 text-xs font-medium transition",
            status === s
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {labelMap[s]}
        </button>
      ))}
    </div>
  );
}
