"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, AlertTriangle } from "lucide-react";
import {
  parseAllocationFile,
  parseSprintFile,
  FileTypeMismatchError,
  type ParsedAllocation,
  type ParsedResource,
  type ParsedSprintPlan,
  type PlanningFileType,
} from "@/lib/excel/parser";
import { ImportPreview } from "./ImportPreview";
import { SprintImportPreview } from "./SprintImportPreview";
import {
  importAllocation,
  importSprintPlan,
  type ImportPayload,
  type ImportSprintPlanPayload,
} from "@/lib/actions/sprints";

type ExpectedType = "allocation" | "sprint";

interface ImportDialogProps {
  expectedType: ExpectedType;
  onImported?: () => void;
  triggerLabel?: string;
}

const TYPE_LABEL: Record<ExpectedType, string> = {
  allocation: "Resource Allocation",
  sprint: "Sprint",
};

export function ImportDialog({ expectedType, onImported, triggerLabel }: ImportDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ExpectedType>(expectedType);
  const [allocation, setAllocation] = useState<ParsedAllocation | null>(null);
  const [sprintPlan, setSprintPlan] = useState<ParsedSprintPlan | null>(null);
  const [mismatch, setMismatch] = useState<PlanningFileType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const bufferRef = useRef<ArrayBuffer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setAllocation(null);
    setSprintPlan(null);
    setMismatch(null);
    setError(null);
  };

  const parseBuffer = (buffer: ArrayBuffer, targetMode: ExpectedType) => {
    reset();
    try {
      if (targetMode === "allocation") {
        setAllocation(parseAllocationFile(buffer));
      } else {
        setSprintPlan(parseSprintFile(buffer));
      }
    } catch (err) {
      if (err instanceof FileTypeMismatchError) {
        setMismatch(err.detected);
      } else {
        setError(
          "Could not read file. Confirm it is a .xlsx export from Excel or Google Sheets."
        );
      }
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xlsx")) {
      setError("Please upload a .xlsx file.");
      return;
    }
    setError(null);
    const buffer = await file.arrayBuffer();
    bufferRef.current = buffer;
    parseBuffer(buffer, mode);
  };

  const handleSwitch = () => {
    if (!mismatch || mismatch === "unknown" || !bufferRef.current) return;
    const next = mismatch as ExpectedType;
    setMode(next);
    parseBuffer(bufferRef.current, next);
  };

  const handleConfirmAllocation = async (meta: {
    name: string;
    start_date: string | null;
    end_date: string | null;
    target_sprint_id: number | null;
    resources: ParsedResource[];
  }) => {
    if (!allocation) return;
    setLoading(true);
    setError(null);

    const allocations: ImportPayload["allocations"] = meta.resources.map((r) => ({
      team: r.team,
      resource: { name: r.name, default_hours_per_sprint: r.standard_hours },
      story_points: r.story_points,
      standard_hours: r.standard_hours,
      leave_days: r.leave_days,
      dependencies: r.dependencies,
      remarks: r.remarks,
      tasks: allocation.tasks
        .filter((t) => t.resourceName.toLowerCase() === r.name.toLowerCase())
        .map((t) => ({
          title: t.title,
          start_date: t.start_date,
          estimated_days: t.estimated_days,
          category: t.category,
          status: t.status,
        })),
    }));

    const result = await importAllocation({
      name: meta.name,
      start_date: meta.start_date,
      end_date: meta.end_date,
      target_sprint_id: meta.target_sprint_id,
      allocations,
    });

    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      finish(result.data.id);
    }
  };

  const handleConfirmSprint = async (
    meta: {
      name: string;
      start_date: string | null;
      end_date: string | null;
      target_sprint_id: number | null;
    },
    payloadTasks: ImportSprintPlanPayload["tasks"]
  ) => {
    if (!sprintPlan) return;
    setLoading(true);
    setError(null);

    const result = await importSprintPlan({
      name: meta.name,
      start_date: meta.start_date,
      end_date: meta.end_date,
      target_sprint_id: meta.target_sprint_id,
      tasks: payloadTasks,
    });

    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      finish(result.data.id);
    }
  };

  const finish = (sprintId: number) => {
    setOpen(false);
    reset();
    setMode(expectedType);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onImported?.();
    router.push(`/sprints/${sprintId}`);
  };

  const handleCancel = () => {
    reset();
    setMode(expectedType);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const hasPreview = allocation || sprintPlan;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          reset();
          setMode(expectedType);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload size={16} className="mr-2" />
          {triggerLabel ?? `Import ${TYPE_LABEL[expectedType]}`}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import {TYPE_LABEL[mode]} from Excel</DialogTitle>
        </DialogHeader>

        {!hasPreview ? (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Upload the {TYPE_LABEL[mode].toLowerCase()} Excel. Parsing happens in your
              browser.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFile}
              className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
            />

            {mismatch && mismatch !== "unknown" && (
              <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
                <div className="space-y-2 text-sm">
                  <p>
                    This looks like a{" "}
                    <span className="font-semibold">{TYPE_LABEL[mismatch as ExpectedType]}</span>{" "}
                    file, not a {TYPE_LABEL[mode]} file.
                  </p>
                  <Button size="sm" variant="outline" onClick={handleSwitch}>
                    Switch to {TYPE_LABEL[mismatch as ExpectedType]} import
                  </Button>
                </div>
              </div>
            )}
            {mismatch === "unknown" && (
              <p className="text-sm text-destructive">
                Could not recognize this file as a {TYPE_LABEL[mode]} or the other planning
                file. Check the headers and try again.
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        ) : allocation ? (
          <ImportPreview
            parsed={allocation}
            onConfirm={handleConfirmAllocation}
            onCancel={handleCancel}
            error={error}
            loading={loading}
          />
        ) : sprintPlan ? (
          <SprintImportPreview
            parsed={sprintPlan}
            onConfirm={handleConfirmSprint}
            onCancel={handleCancel}
            error={error}
            loading={loading}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
