"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Pencil, Save, X } from "lucide-react";
import type { Resource, ResourceRole } from "@/lib/actions/resources";

interface ResourceListProps {
  resources: Resource[];
  onToggle: (id: number) => void;
  onUpdate: (id: number, input: { name: string; team: string; role: ResourceRole; default_hours_per_sprint: number }) => void;
}

const ROLES: ResourceRole[] = ["developer", "qa", "devops", "designer", "pm"];

export function ResourceList({ resources, onToggle, onUpdate }: ResourceListProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string | number>>({});

  const grouped = resources.reduce<Record<string, Resource[]>>((acc, r) => {
    acc[r.team] = acc[r.team] || [];
    acc[r.team].push(r);
    return acc;
  }, {});

  const startEdit = (r: Resource) => {
    setEditingId(r.id);
    setEditForm({
      name: r.name,
      team: r.team,
      role: r.role,
      default_hours_per_sprint: r.default_hours_per_sprint,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = (id: number) => {
    onUpdate(id, {
      name: String(editForm.name),
      team: String(editForm.team),
      role: String(editForm.role) as ResourceRole,
      default_hours_per_sprint: Number(editForm.default_hours_per_sprint),
    });
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([team, members]) => (
        <div key={team} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {team} ({members.length})
          </h3>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {members.map((r) => {
              const isEditing = editingId === r.id;
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-1 items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_120px_80px_100px_auto]"
                >
                  {isEditing ? (
                    <>
                      <Input
                        value={String(editForm.name)}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      />
                      <Input
                        value={String(editForm.team)}
                        onChange={(e) => setEditForm((f) => ({ ...f, team: e.target.value }))}
                      />
                      <select
                        value={String(editForm.role)}
                        onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                        className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        value={Number(editForm.default_hours_per_sprint)}
                        onChange={(e) => setEditForm((f) => ({ ...f, default_hours_per_sprint: e.target.value }))}
                      />
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => saveEdit(r.id)}>
                          <Save size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={cancelEdit}>
                          <X size={16} />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{r.name}</span>
                        <Badge variant={r.is_active ? "success" : "secondary"}>
                          {r.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">{r.role}</span>
                      <span className="text-sm text-muted-foreground">{r.default_hours_per_sprint}h</span>
                      <Switch checked={r.is_active} onCheckedChange={() => onToggle(r.id)} />
                      <div className="flex justify-end">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(r)}>
                          <Pencil size={16} />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {resources.length === 0 && (
        <p className="text-sm text-muted-foreground">No resources yet.</p>
      )}
    </div>
  );
}
