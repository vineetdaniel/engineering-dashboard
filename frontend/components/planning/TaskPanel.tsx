"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryPill } from "./CategoryPill";
import { TaskStatusControl } from "./TaskStatusControl";
import { InlineEdit } from "./InlineEdit";
import { Plus, Trash2 } from "lucide-react";
import type { Task, TaskInput, TaskCategory, TaskStatus } from "@/lib/actions/sprints";

interface TaskPanelProps {
  allocationId: number;
  tasks: Task[];
  onCreate: (input: TaskInput) => void;
  onUpdate: (id: number, updates: Partial<TaskInput>) => void;
  onDelete: (id: number) => void;
}

export function TaskPanel({
  allocationId,
  tasks,
  onCreate,
  onUpdate,
  onDelete,
}: TaskPanelProps) {
  const [newTask, setNewTask] = useState<Partial<TaskInput>>({
    allocation_id: allocationId,
    title: "",
    category: "product",
    status: "todo",
    story_points: 0,
  });

  const handleAdd = () => {
    if (!newTask.title?.trim()) return;
    onCreate({
      allocation_id: allocationId,
      title: newTask.title,
      category: newTask.category || "product",
      start_date: newTask.start_date || null,
      uat_date: newTask.uat_date || null,
      estimated_days: newTask.estimated_days ?? null,
      story_points: Number(newTask.story_points) || 0,
      status: newTask.status || "todo",
      jira_issue_key: newTask.jira_issue_key || null,
    });
    setNewTask({
      allocation_id: allocationId,
      title: "",
      category: "product",
      status: "todo",
      story_points: 0,
    });
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <tr>
              <th className="px-2 py-1.5">Title</th>
              <th className="px-2 py-1.5">Category</th>
              <th className="px-2 py-1.5">Start</th>
              <th className="px-2 py-1.5">UAT</th>
              <th className="px-2 py-1.5">Est days</th>
              <th className="px-2 py-1.5">SP</th>
              <th className="px-2 py-1.5">Status</th>
              <th className="px-2 py-1.5">Jira</th>
              <th className="px-2 py-1.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tasks.map((task) => (
              <tr key={task.id} className="hover:bg-muted/30">
                <td className="px-2 py-1.5">
                  <InlineEdit
                    value={task.title}
                    onSave={(v) => onUpdate(task.id, { title: v })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <CategoryPill
                    category={task.category}
                    onChange={(c) => onUpdate(task.id, { category: c })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    type="date"
                    value={task.start_date || ""}
                    onChange={(e) => onUpdate(task.id, { start_date: e.target.value || null })}
                    className="h-7 px-1 py-0.5 text-xs"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    type="date"
                    value={task.uat_date || ""}
                    onChange={(e) => onUpdate(task.id, { uat_date: e.target.value || null })}
                    className="h-7 px-1 py-0.5 text-xs"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <InlineEdit
                    value={task.estimated_days ?? ""}
                    type="number"
                    onSave={(v) => onUpdate(task.id, { estimated_days: v === "" ? null : Number(v) })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <InlineEdit
                    value={task.story_points}
                    type="number"
                    onSave={(v) => onUpdate(task.id, { story_points: Number(v) || 0 })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <TaskStatusControl
                    status={task.status}
                    onChange={(s) => onUpdate(task.id, { status: s })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <InlineEdit
                    value={task.jira_issue_key || ""}
                    onSave={(v) => onUpdate(task.id, { jira_issue_key: v || null })}
                    placeholder="—"
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => onDelete(task.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </td>
              </tr>
            ))}
            <tr className="bg-muted/20">
              <td className="px-2 py-1.5">
                <Input
                  value={newTask.title || ""}
                  onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))}
                  placeholder="New task title"
                  className="h-7 px-2 py-0.5 text-xs"
                />
              </td>
              <td className="px-2 py-1.5">
                <select
                  value={newTask.category}
                  onChange={(e) => setNewTask((t) => ({ ...t, category: e.target.value as TaskCategory }))}
                  className="h-7 rounded border border-input bg-background px-1 text-xs"
                >
                  <option value="product">Product</option>
                  <option value="integration">Integration</option>
                  <option value="other">Other</option>
                </select>
              </td>
              <td className="px-2 py-1.5">
                <Input
                  type="date"
                  value={newTask.start_date || ""}
                  onChange={(e) => setNewTask((t) => ({ ...t, start_date: e.target.value || null }))}
                  className="h-7 px-1 py-0.5 text-xs"
                />
              </td>
              <td className="px-2 py-1.5">
                <Input
                  type="date"
                  value={newTask.uat_date || ""}
                  onChange={(e) => setNewTask((t) => ({ ...t, uat_date: e.target.value || null }))}
                  className="h-7 px-1 py-0.5 text-xs"
                />
              </td>
              <td className="px-2 py-1.5">
                <Input
                  type="number"
                  value={newTask.estimated_days ?? ""}
                  onChange={(e) => setNewTask((t) => ({ ...t, estimated_days: e.target.value === "" ? null : Number(e.target.value) }))}
                  className="h-7 px-1 py-0.5 text-xs"
                  placeholder="Days"
                />
              </td>
              <td className="px-2 py-1.5">
                <Input
                  type="number"
                  value={newTask.story_points ?? 0}
                  onChange={(e) => setNewTask((t) => ({ ...t, story_points: Number(e.target.value) || 0 }))}
                  className="h-7 px-1 py-0.5 text-xs"
                />
              </td>
              <td className="px-2 py-1.5">
                <select
                  value={newTask.status}
                  onChange={(e) => setNewTask((t) => ({ ...t, status: e.target.value as TaskStatus }))}
                  className="h-7 rounded border border-input bg-background px-1 text-xs"
                >
                  <option value="todo">Todo</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </td>
              <td className="px-2 py-1.5">
                <Input
                  value={newTask.jira_issue_key || ""}
                  onChange={(e) => setNewTask((t) => ({ ...t, jira_issue_key: e.target.value || null }))}
                  className="h-7 px-1 py-0.5 text-xs"
                  placeholder="KEY-123"
                />
              </td>
              <td className="px-2 py-1.5 text-right">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleAdd}>
                  <Plus size={16} />
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
