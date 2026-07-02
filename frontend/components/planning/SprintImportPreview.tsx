"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ParsedSprintPlan } from "@/lib/excel/parser";
import type { ImportSprintPlanPayload } from "@/lib/actions/sprints";
import { SprintConflictNotice } from "./SprintConflictNotice";
import { suggestSprintName } from "@/lib/dates";

interface SprintImportPreviewProps {
  parsed: ParsedSprintPlan;
  onConfirm: (
    meta: {
      name: string;
      start_date: string | null;
      end_date: string | null;
      target_sprint_id: number | null;
    },
    tasks: ImportSprintPlanPayload["tasks"]
  ) => void;
  onCancel: () => void;
  error?: string | null;
  loading?: boolean;
}

export function SprintImportPreview({
  parsed,
  onConfirm,
  onCancel,
  error,
  loading,
}: SprintImportPreviewProps) {
  const [name, setName] = useState(parsed.name);
  const [startDate, setStartDate] = useState(parsed.start_date || "");
  const [endDate, setEndDate] = useState(parsed.end_date || "");
  const [targetSprintId, setTargetSprintId] = useState<number | null>(null);

  const byOwner = parsed.tasks.reduce<Record<string, typeof parsed.tasks>>((acc, t) => {
    acc[t.owner] = acc[t.owner] || [];
    acc[t.owner].push(t);
    return acc;
  }, {});
  const ownerCount = Object.keys(byOwner).length;

  const handleConfirm = () => {
    onConfirm(
      {
        name,
        start_date: startDate || null,
        end_date: endDate || null,
        target_sprint_id: targetSprintId,
      },
      parsed.tasks.map((t) => ({
        owner: t.owner,
        title: t.title,
        start_date: t.start_date,
        uat_date: t.uat_date,
        estimated_days: t.estimated_days,
        category: t.category,
        remarks: t.remarks ?? null,
      }))
    );
  };

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
          {parsed.tasks.length} task{parsed.tasks.length === 1 ? "" : "s"} across {ownerCount}{" "}
          owner{ownerCount === 1 ? "" : "s"}
        </p>
        {Object.entries(byOwner).map(([owner, tasks]) => (
          <div key={owner} className="rounded-lg border border-border bg-card p-3">
            <p className="text-sm font-semibold">
              {owner} ({tasks.length})
            </p>
            <ul className="mt-2 space-y-1">
              {tasks.map((t, idx) => (
                <li key={idx} className="flex flex-wrap items-center gap-2 text-sm">
                  {t.warnings.length > 0 ? (
                    <AlertCircle size={14} className="text-warning" />
                  ) : (
                    <CheckCircle2 size={14} className="text-success" />
                  )}
                  <span>{t.title}</span>
                  <span className="text-muted-foreground">
                    {t.start_date ? `start ${t.start_date}` : "no start"}
                    {t.uat_date ? ` · UAT ${t.uat_date}` : ""}
                    {t.estimated_days != null ? ` · ${t.estimated_days}d` : ""}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {t.category}
                  </Badge>
                  {t.warnings.length > 0 && (
                    <Badge variant="warning" className="text-xs">
                      {t.warnings.join(", ")}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Owners not yet known as resources will be created with capacity pending — upload the
        matching Resource Allocation file later to fill in story points and hours.
      </p>

      {parsed.warnings.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Warnings
          </p>
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
        <Button variant="ghost" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} disabled={loading || parsed.tasks.length === 0}>
          {loading ? "Importing..." : targetSprintId != null ? "Attach & import" : "Confirm import"}
        </Button>
      </div>
    </div>
  );
}
