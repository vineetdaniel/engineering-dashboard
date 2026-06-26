"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InlineEdit } from "./InlineEdit";
import { TaskPanel } from "./TaskPanel";
import { Lock, Unlock, Trash2, Plus } from "lucide-react";
import type { Allocation, Resource, TaskInput } from "@/lib/actions/sprints";

interface AllocationTableProps {
  allocations: Allocation[];
  resources: Resource[];
  onUpdate: (id: number, updates: Partial<Allocation>) => void;
  onDelete: (id: number) => void;
  onAdd: (resourceId: number, team: string) => void;
  onCreateTask: (input: TaskInput) => void;
  onUpdateTask: (id: number, updates: Partial<TaskInput>) => void;
  onDeleteTask: (id: number) => void;
}

export function AllocationTable({
  allocations,
  resources,
  onUpdate,
  onDelete,
  onAdd,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}: AllocationTableProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [selectedResource, setSelectedResource] = useState<Record<string, string>>({});

  const grouped = allocations.reduce<Record<string, Allocation[]>>((acc, a) => {
    acc[a.team] = acc[a.team] || [];
    acc[a.team].push(a);
    return acc;
  }, {});

  const teams = Object.keys(grouped).sort();
  const activeResources = resources.filter((r) => r.is_active);
  const allocatedIds = new Set(allocations.map((a) => a.resource_id));

  const toggleExpand = (id: number) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const handleNumberSave = (id: number, field: keyof Allocation, raw: string) => {
    const value = raw === "" ? 0 : Number(raw);
    if (Number.isNaN(value)) return;
    onUpdate(id, { [field]: value } as Partial<Allocation>);
  };

  return (
    <div className="space-y-6">
      {teams.map((team) => {
        const teamAllocations = grouped[team];
        const teamResources = activeResources.filter(
          (r) => !allocatedIds.has(r.id)
        );
        return (
          <div key={team} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {team} ({teamAllocations.length})
            </h3>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2 w-48">Resource</th>
                      <th className="px-3 py-2 w-28">Story pts</th>
                      <th className="px-3 py-2 w-28">Std hours</th>
                      <th className="px-3 py-2 w-24">Leave</th>
                      <th className="px-3 py-2 w-28">Eff hours</th>
                      <th className="px-3 py-2 w-40">Dependencies</th>
                      <th className="px-3 py-2 w-40">Remarks</th>
                      <th className="px-3 py-2 w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {teamAllocations.map((a) => {
                      const isExpanded = expanded.has(a.id);
                      return (
                        <>
                          <tr key={a.id} className="hover:bg-muted/30">
                            <td className="px-3 py-2">
                              <button
                                onClick={() => toggleExpand(a.id)}
                                className="text-left font-medium hover:text-primary"
                              >
                                {a.resource_name}
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {a.resource_role}
                                </span>
                              </button>
                            </td>
                            <td className="px-3 py-2">
                              <InlineEdit
                                value={a.story_points}
                                type="number"
                                onSave={(v) => handleNumberSave(a.id, "story_points", v)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <InlineEdit
                                value={a.standard_hours}
                                type="number"
                                onSave={(v) => handleNumberSave(a.id, "standard_hours", v)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <InlineEdit
                                value={a.leave_days}
                                type="number"
                                onSave={(v) => handleNumberSave(a.id, "leave_days", v)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <span className={a.effective_hours_overridden ? "font-semibold text-primary" : ""}>
                                  {a.effective_hours}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() =>
                                    onUpdate(a.id, {
                                      effective_hours_overridden: !a.effective_hours_overridden,
                                    })
                                  }
                                  title={a.effective_hours_overridden ? "Unlock auto-compute" : "Override effective hours"}
                                >
                                  {a.effective_hours_overridden ? (
                                    <Lock size={14} />
                                  ) : (
                                    <Unlock size={14} />
                                  )}
                                </Button>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <InlineEdit
                                value={a.dependencies || ""}
                                onSave={(v) => onUpdate(a.id, { dependencies: v })}
                                placeholder="—"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <InlineEdit
                                value={a.remarks || ""}
                                onSave={(v) => onUpdate(a.id, { remarks: v })}
                                placeholder="—"
                              />
                            </td>
                            <td className="px-3 py-2">
                              {confirmDelete === a.id ? (
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    className="h-7 px-2 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => {
                                      onDelete(a.id);
                                      setConfirmDelete(null);
                                    }}
                                  >
                                    Yes
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => setConfirmDelete(null)}
                                  >
                                    No
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => setConfirmDelete(a.id)}
                                >
                                  <Trash2 size={16} />
                                </Button>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${a.id}-panel`}>
                              <td colSpan={8} className="bg-muted/20 px-3 py-3">
                                <TaskPanel
                                  allocationId={a.id}
                                  tasks={a.tasks}
                                  onCreate={onCreateTask}
                                  onUpdate={onUpdateTask}
                                  onDelete={onDeleteTask}
                                />
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-2 border-t border-border px-3 py-2">
                <select
                  value={selectedResource[team] || ""}
                  onChange={(e) => setSelectedResource((s) => ({ ...s, [team]: e.target.value }))}
                  className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                >
                  <option value="">Add resource to {team}...</option>
                  {teamResources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.role})
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!selectedResource[team]}
                  onClick={() => {
                    const id = Number(selectedResource[team]);
                    if (id) {
                      onAdd(id, team);
                      setSelectedResource((s) => ({ ...s, [team]: "" }));
                    }
                  }}
                >
                  <Plus size={16} className="mr-1" />
                  Add
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
