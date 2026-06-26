"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { suggestSprintName } from "@/lib/dates";
import type { SprintInput, SprintStatus } from "@/lib/actions/sprints";

interface SprintCreateModalProps {
  onCreate: (input: SprintInput) => Promise<{ error?: string } | undefined>;
  children?: React.ReactNode;
}

export function SprintCreateModal({ onCreate, children }: SprintCreateModalProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<SprintStatus>("planning");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setStartDate("");
    setEndDate("");
    setStatus("planning");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await onCreate({
      name,
      start_date: startDate || null,
      end_date: endDate || null,
      status,
    });
    setSubmitting(false);
    if (result?.error) {
      setError(result.error);
    } else {
      reset();
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || <Button>New sprint</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create new sprint</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sprint-name">Sprint name</Label>
            <Input
              id="sprint-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                !name.trim() && (startDate || endDate)
                  ? suggestSprintName(null, startDate, endDate)
                  : "e.g. Sprint 24"
              }
            />
            {!name.trim() && (startDate || endDate) && (
              <p className="text-xs text-muted-foreground">
                Will be named <span className="font-medium">{suggestSprintName(null, startDate, endDate)}</span>
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sprint-start">Start date</Label>
              <Input
                id="sprint-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sprint-end">End date</Label>
              <Input
                id="sprint-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sprint-status">Status</Label>
            <select
              id="sprint-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as SprintStatus)}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create sprint"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
