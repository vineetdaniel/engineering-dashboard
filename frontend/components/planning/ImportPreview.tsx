"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ParsedAllocation, ParsedResource } from "@/lib/excel/parser";
import { KNOWN_TEAMS } from "@/lib/excel/parser";
import { SprintConflictNotice } from "./SprintConflictNotice";
import { suggestSprintName } from "@/lib/dates";

interface ImportPreviewProps {
  parsed: ParsedAllocation;
  onConfirm: (payload: {
    name: string;
    start_date: string | null;
    end_date: string | null;
    target_sprint_id: number | null;
    resources: ParsedResource[];
  }) => void;
  onCancel: () => void;
  error?: string | null;
  loading?: boolean;
}

export function ImportPreview({ parsed, onConfirm, onCancel, error, loading }: ImportPreviewProps) {
  const [name, setName] = useState(parsed.name);
  const [startDate, setStartDate] = useState(parsed.start_date || "");
  const [endDate, setEndDate] = useState(parsed.end_date || "");
  const [targetSprintId, setTargetSprintId] = useState<number | null>(null);
  // Editable copy so the PM can reassign teams (the file often lacks a header
  // for some groups, e.g. Frontend) before confirming.
  const [resources, setResources] = useState<ParsedResource[]>(parsed.resources);

  const setTeam = (index: number, team: string) =>
    setResources((rs) => rs.map((r, i) => (i === index ? { ...r, team } : r)));

  // Team options: the known set plus any team already present in the file.
  const teamOptions = Array.from(
    new Set([...KNOWN_TEAMS, ...resources.map((r) => r.team)])
  );

  const teamCount = new Set(resources.map((r) => r.team)).size;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Sprint name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={suggestSprintName(null, startDate, endDate)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Start date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>End date</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      <SprintConflictNotice
        name={suggestSprintName(name, startDate, endDate)}
        startDate={startDate}
        endDate={endDate}
        value={targetSprintId}
        onChange={({ targetSprintId }) => setTargetSprintId(targetSprintId)}
      />

      <div className="space-y-3">
        <p className="text-sm font-medium">
          {resources.length} resources across {teamCount} team
          {teamCount === 1 ? "" : "s"} — set each person&apos;s team below
        </p>
        <div className="rounded-lg border border-border bg-card">
          <ul className="divide-y divide-border">
            {resources.map((r, idx) => (
              <li key={idx} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                {r.warnings.length > 0 ? (
                  <AlertCircle size={14} className="shrink-0 text-warning" />
                ) : (
                  <CheckCircle2 size={14} className="shrink-0 text-success" />
                )}
                <span className="min-w-[140px] font-medium">{r.name}</span>
                <select
                  value={r.team}
                  onChange={(e) => setTeam(idx, e.target.value)}
                  className="h-7 rounded border border-input bg-background px-2 text-xs"
                >
                  {teamOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <span className="text-muted-foreground">
                  {r.story_points} SP · {r.standard_hours}h · {r.leave_days} leave
                </span>
                {r.warnings.length > 0 && (
                  <Badge variant="warning" className="text-xs">
                    {r.warnings.join(", ")}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">{parsed.tasks.length} tasks found</p>
        <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-card p-3">
          {parsed.tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks parsed.</p>
          ) : (
            <ul className="space-y-1">
              {parsed.tasks.map((t, idx) => (
                <li key={idx} className="text-sm">
                  <span className="font-medium">{t.resourceName}</span>
                  {" → "}
                  <span>"{t.title}"{t.estimated_days != null ? ` · ${t.estimated_days} days` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {parsed.warnings.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Warnings</p>
          <ul className="space-y-1">
            {parsed.warnings.map((w, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-warning">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button
          onClick={() =>
            onConfirm({
              name,
              start_date: startDate || null,
              end_date: endDate || null,
              target_sprint_id: targetSprintId,
              resources,
            })
          }
          disabled={loading}
        >
          {loading ? "Importing..." : targetSprintId != null ? "Attach & import" : "Confirm import"}
        </Button>
      </div>
    </div>
  );
}
