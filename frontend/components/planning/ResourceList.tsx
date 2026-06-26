"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Pencil, Save, X, GitBranch } from "lucide-react";
import type { Resource, ResourceRole } from "@/lib/actions/resources";
import type { GitHubLogin, JiraAssignee } from "@/lib/api";

interface ResourceListProps {
  resources: Resource[];
  githubLogins: GitHubLogin[];
  jiraAssignees: JiraAssignee[];
  onToggle: (id: number) => void;
  onUpdate: (id: number, input: { name: string; team: string; role: ResourceRole; default_hours_per_sprint: number; github_handle: string | null; jira_account_id: string | null }) => void;
}

const ROLES: ResourceRole[] = ["developer", "qa", "devops", "designer", "pm"];

function normName(s: string) { return s.toLowerCase().replace(/[^a-z0-9]/g, ""); }

function matchScore(resourceName: string, candidateName: string): number {
  const rn = normName(resourceName);
  const cn = normName(candidateName);
  if (cn === rn) return 3;
  const rParts = resourceName.toLowerCase().split(/\s+/);
  const cParts = candidateName.toLowerCase().split(/[\s._-]+/);
  const shared = rParts.filter((p) => p.length > 2 && cParts.some((c) => c.includes(p) || p.includes(c))).length;
  if (shared > 0) return shared;
  return 0;
}

export function ResourceList({ resources, githubLogins, jiraAssignees, onToggle, onUpdate }: ResourceListProps) {
  const assignedHandles = new Set(resources.map((r) => r.github_handle).filter(Boolean) as string[]);
  const assignedJiraIds = new Set(resources.map((r) => r.jira_account_id).filter(Boolean) as string[]);

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
      github_handle: r.github_handle ?? "",
      jira_account_id: r.jira_account_id ?? "",
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const saveEdit = (id: number) => {
    const handle = String(editForm.github_handle ?? "").trim();
    const jiraId = String(editForm.jira_account_id ?? "").trim();
    onUpdate(id, {
      name: String(editForm.name),
      team: String(editForm.team),
      role: String(editForm.role) as ResourceRole,
      default_hours_per_sprint: Number(editForm.default_hours_per_sprint),
      github_handle: handle || null,
      jira_account_id: jiraId || null,
    });
    setEditingId(null);
  };

  const jiraLabel = (accountId: string | null) => {
    if (!accountId) return null;
    return jiraAssignees.find((j) => j.account_id === accountId);
  };

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([team, members]) => (
        <div key={team} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {team} ({members.length})
          </h3>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">GitHub</th>
                  <th className="px-4 py-2">Jira</th>
                  <th className="px-4 py-2">Hrs/sprint</th>
                  <th className="px-4 py-2">Active</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((r) => {
                  const isEditing = editingId === r.id;
                  const jira = jiraLabel(r.jira_account_id);
                  return (
                    <tr key={r.id} className="hover:bg-muted/20">
                      {isEditing ? (
                        <>
                          <td className="px-4 py-2">
                            <Input value={String(editForm.name)} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                          </td>
                          <td className="px-4 py-2">
                            <select value={String(editForm.role)} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm">
                              {ROLES.map((role) => (
                                <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            {(() => {
                              const name = String(editForm.name ?? "");
                              const currentHandle = String(editForm.github_handle ?? "");
                              const sorted = [...githubLogins]
                                .filter((g) => !assignedHandles.has(g.login) || g.login === currentHandle)
                                .sort((a, b) => {
                                  const sa = matchScore(name, a.display_name) || matchScore(name, a.login);
                                  const sb = matchScore(name, b.display_name) || matchScore(name, b.login);
                                  return sb - sa;
                                });
                              return (
                                <select value={currentHandle}
                                  onChange={(e) => setEditForm((f) => ({ ...f, github_handle: e.target.value }))}
                                  className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm">
                                  <option value="">— unassigned —</option>
                                  {sorted.map((g) => (
                                    <option key={g.login} value={g.login}>
                                      {g.login} · {g.display_name} ({g.commits} commits)
                                    </option>
                                  ))}
                                  {githubLogins.length === 0 && <option disabled>Sync GitHub first</option>}
                                </select>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-2">
                            {(() => {
                              const name = String(editForm.name ?? "");
                              const currentJira = String(editForm.jira_account_id ?? "");
                              const sorted = [...jiraAssignees]
                                .filter((j) => !assignedJiraIds.has(j.account_id) || j.account_id === currentJira)
                                .sort((a, b) => {
                                  const sa = matchScore(name, a.display_name);
                                  const sb = matchScore(name, b.display_name);
                                  return sb - sa;
                                });
                              return (
                                <select value={currentJira}
                                  onChange={(e) => setEditForm((f) => ({ ...f, jira_account_id: e.target.value }))}
                                  className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm">
                                  <option value="">— unassigned —</option>
                                  {sorted.map((j) => (
                                    <option key={j.account_id} value={j.account_id}>
                                      {j.display_name} ({j.open_issues} open)
                                    </option>
                                  ))}
                                  {jiraAssignees.length === 0 && <option disabled>Sync Jira first</option>}
                                </select>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-2">
                            <Input type="number" value={Number(editForm.default_hours_per_sprint)}
                              onChange={(e) => setEditForm((f) => ({ ...f, default_hours_per_sprint: e.target.value }))} />
                          </td>
                          <td className="px-4 py-2" />
                          <td className="px-4 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => saveEdit(r.id)}><Save size={16} /></Button>
                              <Button variant="ghost" size="icon" onClick={cancelEdit}><X size={16} /></Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{r.name}</span>
                              {!r.is_active && <Badge variant="secondary">Inactive</Badge>}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">{r.role}</td>
                          <td className="px-4 py-2">
                            {r.github_handle ? (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <GitBranch size={11} />{r.github_handle}
                              </span>
                            ) : (
                              <span className="text-xs italic text-muted-foreground/40">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {jira ? (
                              <span className="text-muted-foreground">
                                {jira.display_name}
                                <span className="ml-1 text-xs text-muted-foreground/60">({jira.open_issues} open)</span>
                              </span>
                            ) : (
                              <span className="text-xs italic text-muted-foreground/40">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">{r.default_hours_per_sprint}h</td>
                          <td className="px-4 py-2">
                            <Switch checked={r.is_active} onCheckedChange={() => onToggle(r.id)} />
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex justify-end">
                              <Button variant="ghost" size="icon" onClick={() => startEdit(r)}><Pencil size={16} /></Button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {resources.length === 0 && <p className="text-sm text-muted-foreground">No resources yet.</p>}
    </div>
  );
}
