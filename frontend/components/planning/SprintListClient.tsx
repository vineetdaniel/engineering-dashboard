"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SprintList } from "./SprintList";
import { SprintCreateModal } from "./SprintCreateModal";
import { ImportDialog } from "./ImportDialog";
import { PlanningSubNav } from "./PlanningSubNav";
import { createSprint, listSprints, type SprintListItem, type SprintInput, type SprintStatus } from "@/lib/actions/sprints";

interface SprintListClientProps {
  initialSprints: SprintListItem[];
}

export function SprintListClient({ initialSprints }: SprintListClientProps) {
  const [sprints, setSprints] = useState<SprintListItem[]>(initialSprints);
  const [status, setStatus] = useState<SprintStatus | "all">("all");
  const [error, setError] = useState<string | null>(null);

  const load = async (filter: SprintStatus | "all" = status) => {
    const result = await listSprints(filter);
    if (result.error) setError(result.error);
    else setSprints(result.data || []);
  };

  const handleCreate = async (input: SprintInput) => {
    const result = await createSprint(input);
    if (result.error) return { error: result.error };
    await load(status);
    return {};
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sprint planning</h1>
          <p className="text-sm text-muted-foreground">Manage sprints, allocations, and tasks.</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportDialog expectedType="sprint" onImported={() => load(status)} />
          <SprintCreateModal onCreate={handleCreate}>
            <Button>New sprint</Button>
          </SprintCreateModal>
        </div>
      </div>

      <PlanningSubNav active="sprints" />

        <Tabs
          value={status}
          onValueChange={(v) => {
            const next = v as SprintStatus | "all";
            setStatus(next);
            load(next);
          }}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="planning">Planning</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <SprintList sprints={sprints} />
    </div>
  );
}
