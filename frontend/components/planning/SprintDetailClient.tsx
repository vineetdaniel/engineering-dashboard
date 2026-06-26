"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SprintHeader } from "./SprintHeader";
import { AllocationTable } from "./AllocationTable";
import { SummaryCards } from "./SummaryCards";
import { SprintTaskMetrics } from "./SprintTaskMetrics";
import { SprintJiraTickets } from "./SprintJiraTickets";
import {
  updateSprint,
  createAllocation,
  updateAllocation,
  deleteAllocation,
  createTask,
  updateTask,
  deleteTask,
  type SprintDetail,
  type Resource,
  type Allocation,
  type TaskInput,
} from "@/lib/actions/sprints";
import Link from "next/link";

interface SprintDetailClientProps {
  initialSprint: SprintDetail;
  resources: Resource[];
}

export function SprintDetailClient({ initialSprint, resources }: SprintDetailClientProps) {
  const [sprint, setSprint] = useState<SprintDetail>(initialSprint);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    // For tasks and new allocations we reload the page to keep state simple.
    window.location.reload();
  };

  const handleSprintUpdate = async (updates: Partial<SprintDetail>) => {
    const result = await updateSprint(sprint.id, updates);
    if (result.error) setError(result.error);
    else if (result.data) {
      setSprint((s) => ({ ...s, ...result.data }));
    }
  };

  const handleUpdateAllocation = async (
    allocationId: number,
    updates: Partial<Allocation>
  ) => {
    const result = await updateAllocation(allocationId, updates);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setSprint((s) => ({
        ...s,
        allocations: s.allocations.map((a) => (a.id === allocationId ? { ...result.data!, tasks: a.tasks } : a)),
      }));
    }
  };

  const handleDeleteAllocation = async (allocationId: number) => {
    const result = await deleteAllocation(allocationId);
    if (result.error) setError(result.error);
    else {
      setSprint((s) => ({
        ...s,
        allocations: s.allocations.filter((a) => a.id !== allocationId),
      }));
    }
  };

  const handleAddAllocation = async (resourceId: number, team: string) => {
    const result = await createAllocation({
      sprint_id: sprint.id,
      resource_id: resourceId,
      team,
      story_points: 0,
      standard_hours: 0,
      leave_days: 0,
    });
    if (result.error) setError(result.error);
    else {
      // Full refresh to get tasks array initialized and resource details
      refresh();
    }
  };

  const handleCreateTask = async (input: TaskInput) => {
    const result = await createTask(input);
    if (result.error) setError(result.error);
    else {
      setSprint((s) => ({
        ...s,
        allocations: s.allocations.map((a) => {
          if (a.id !== input.allocation_id) return a;
          return {
            ...a,
            tasks: [...a.tasks, result.data!],
          };
        }),
      }));
    }
  };

  const handleUpdateTask = async (taskId: number, updates: Partial<TaskInput>) => {
    const result = await updateTask(taskId, updates);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setSprint((s) => ({
        ...s,
        allocations: s.allocations.map((a) => ({
          ...a,
          tasks: a.tasks.map((t) => (t.id === taskId ? result.data! : t)),
        })),
      }));
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    const result = await deleteTask(taskId);
    if (result.error) setError(result.error);
    else {
      setSprint((s) => ({
        ...s,
        allocations: s.allocations.map((a) => ({
          ...a,
          tasks: a.tasks.filter((t) => t.id !== taskId),
        })),
      }));
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Sprint detail</div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/sprints">Back to sprints</Link>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <SprintHeader sprint={sprint} onChange={handleSprintUpdate} />

      <SummaryCards allocations={sprint.allocations} />

      <SprintTaskMetrics allocations={sprint.allocations} />

      <SprintJiraTickets sprintId={sprint.id} />

      <AllocationTable
        allocations={sprint.allocations}
        resources={resources}
        onUpdate={handleUpdateAllocation}
        onDelete={handleDeleteAllocation}
        onAdd={handleAddAllocation}
        onCreateTask={handleCreateTask}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
      />
    </div>
  );
}
