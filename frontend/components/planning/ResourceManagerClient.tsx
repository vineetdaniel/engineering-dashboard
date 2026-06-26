"use client";

import { useEffect, useState } from "react";
import { ResourceForm } from "./ResourceForm";
import { ResourceList } from "./ResourceList";
import { PlanningSubNav } from "./PlanningSubNav";
import { ImportDialog } from "./ImportDialog";
import { ResourceTeamSummary } from "./ResourceTeamSummary";
import {
  listResources,
  createResource,
  updateResource,
  toggleResourceActive,
  type Resource,
  type ResourceInput,
} from "@/lib/actions/resources";
import { getGitHubLogins, getJiraAssignees, type GitHubLogin, type JiraAssignee } from "@/lib/api";

interface ResourceManagerClientProps {
  initialResources: Resource[];
}

export function ResourceManagerClient({ initialResources }: ResourceManagerClientProps) {
  const [resources, setResources] = useState<Resource[]>(initialResources);
  const [githubLogins, setGithubLogins] = useState<GitHubLogin[]>([]);
  const [jiraAssignees, setJiraAssignees] = useState<JiraAssignee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | undefined>(undefined);

  useEffect(() => {
    getGitHubLogins().then(setGithubLogins).catch(() => {});
    getJiraAssignees().then(setJiraAssignees).catch(() => {});
  }, []);

  const load = async () => {
    const result = await listResources();
    if (result.error) setError(result.error);
    else setResources(result.data || []);
  };

  const handleCreate = async (input: ResourceInput) => {
    setFormError(undefined);
    const result = await createResource(input);
    if (result.error) {
      setFormError(result.error);
    } else {
      await load();
    }
  };

  const handleUpdate = async (
    id: number,
    input: { name: string; team: string; role: ResourceInput["role"]; default_hours_per_sprint: number; github_handle: string | null; jira_account_id: string | null }
  ) => {
    const result = await updateResource(id, input);
    if (result?.error) setError(result.error);
    else await load();
  };

  const handleToggle = async (id: number) => {
    await toggleResourceActive(id);
    await load();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resource manager</h1>
          <p className="text-sm text-muted-foreground">Manage engineering resources and team assignments.</p>
        </div>
        <ImportDialog expectedType="allocation" onImported={load} />
      </div>

      <PlanningSubNav active="resources" />

      <ResourceTeamSummary resources={resources} />

      <ResourceForm onSubmit={handleCreate} error={formError} />

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <ResourceList
          resources={resources}
          githubLogins={githubLogins}
          jiraAssignees={jiraAssignees}
          onToggle={handleToggle}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
