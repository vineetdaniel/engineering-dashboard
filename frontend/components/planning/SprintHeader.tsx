"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Sprint, SprintStatus } from "@/lib/actions/sprints";

interface SprintHeaderProps {
  sprint: Sprint;
  onChange: (updates: Partial<Sprint>) => void;
}

const statusVariant: Record<SprintStatus, "default" | "success" | "warning" | "secondary"> = {
  planning: "secondary",
  active: "success",
  completed: "warning",
};

export function SprintHeader({ sprint, onChange }: SprintHeaderProps) {
  const [name, setName] = useState(sprint.name);
  const [startDate, setStartDate] = useState(sprint.start_date || "");
  const [endDate, setEndDate] = useState(sprint.end_date || "");

  useEffect(() => {
    setName(sprint.name);
    setStartDate(sprint.start_date || "");
    setEndDate(sprint.end_date || "");
  }, [sprint]);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name !== sprint.name) onChange({ name: name.trim() });
          }}
          className="h-10 max-w-md border-transparent bg-transparent px-0 text-xl font-bold focus:bg-background focus:px-3"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            onBlur={() => startDate !== (sprint.start_date || "") && onChange({ start_date: startDate || null })}
            className="h-8 w-auto text-sm"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            onBlur={() => endDate !== (sprint.end_date || "") && onChange({ end_date: endDate || null })}
            className="h-8 w-auto text-sm"
          />
          <select
            value={sprint.status}
            onChange={(e) => onChange({ status: e.target.value as SprintStatus })}
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={statusVariant[sprint.status]} className="text-sm">{sprint.status}</Badge>
      </div>
    </div>
  );
}
