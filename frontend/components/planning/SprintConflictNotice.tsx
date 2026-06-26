"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Link2, Plus } from "lucide-react";
import { findSprintConflicts, type Sprint } from "@/lib/actions/sprints";

export interface AttachChoice {
  /** Sprint id to attach to, or null to create/match by name+dates. */
  targetSprintId: number | null;
}

interface SprintConflictNoticeProps {
  name: string;
  startDate: string;
  endDate: string;
  /** Currently chosen target sprint id (null = create new). */
  value: number | null;
  onChange: (choice: AttachChoice) => void;
}

/**
 * Detects sprints that conflict with the import's name/dates and lets the PM
 * attach to the overlapping sprint instead of being blocked. Auto-suggests the
 * specific conflicting sprint with a one-click "Attach" button.
 */
export function SprintConflictNotice({
  name,
  startDate,
  endDate,
  value,
  onChange,
}: SprintConflictNoticeProps) {
  const [nameMatch, setNameMatch] = useState<Sprint | null>(null);
  const [overlaps, setOverlaps] = useState<Sprint[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await findSprintConflicts({
        name,
        start_date: startDate || null,
        end_date: endDate || null,
      });
      if (cancelled || res.error || !res.data) return;
      setNameMatch(res.data.nameMatch);
      setOverlaps(res.data.overlaps);
    })();
    return () => {
      cancelled = true;
    };
  }, [name, startDate, endDate]);

  // A name match means findOrCreateSprint will reuse it automatically — show as
  // an informational badge, not a blocker.
  if (nameMatch && (value == null || value === nameMatch.id)) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
        <Link2 size={16} className="text-muted-foreground" />
        <span>
          Will update the existing sprint{" "}
          <span className="font-semibold">{nameMatch.name}</span> (matched by name).
        </span>
      </div>
    );
  }

  // Only date-overlapping sprints that aren't the (already-handled) name match.
  const conflicts = overlaps.filter((s) => !nameMatch || s.id !== nameMatch.id);
  if (conflicts.length === 0) {
    return value == null ? (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
        <Plus size={16} className="text-muted-foreground" />
        <span>A new sprint will be created from these dates.</span>
      </div>
    ) : null;
  }

  return (
    <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
        <p>
          These dates overlap{" "}
          {conflicts.length === 1 ? "an existing sprint" : `${conflicts.length} existing sprints`}.
          Attach this import to one of them, or change the dates to create a new sprint.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 pl-6">
        {conflicts.map((s) => {
          const active = value === s.id;
          return (
            <Button
              key={s.id}
              size="sm"
              variant={active ? "default" : "outline"}
              onClick={() => onChange({ targetSprintId: active ? null : s.id })}
            >
              {active ? "Attached to " : "Attach to "}
              {s.name}
              {s.start_date && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {String(s.start_date).slice(0, 10)}
                </Badge>
              )}
            </Button>
          );
        })}
        {value != null && (
          <Button size="sm" variant="ghost" onClick={() => onChange({ targetSprintId: null })}>
            Cancel attach (create new)
          </Button>
        )}
      </div>
    </div>
  );
}
