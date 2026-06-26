"use server";

import { query, queryOne, withTransaction } from "@/lib/db";
import { listResources } from "@/lib/actions/resources";
import type { PoolClient, QueryResultRow } from "pg";

export type SprintStatus = "planning" | "active" | "completed";
export type TaskCategory = "product" | "integration" | "other";
export type TaskStatus = "todo" | "in_progress" | "done";
export type ResourceRole = "developer" | "qa" | "devops" | "designer" | "pm";

export interface Resource {
  id: number;
  name: string;
  team: string;
  role: ResourceRole;
  default_hours_per_sprint: number;
  is_active: boolean;
}

export interface Sprint {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: SprintStatus;
  created_at: string;
  updated_at: string;
}

export interface SprintListItem extends Sprint {
  resource_count: number;
  total_story_points: number;
}

export interface Allocation {
  id: number;
  sprint_id: number;
  resource_id: number;
  team: string;
  story_points: number;
  standard_hours: number;
  leave_days: number;
  effective_hours: number;
  effective_hours_overridden: boolean;
  dependencies: string | null;
  remarks: string | null;
  resource_name: string;
  resource_role: ResourceRole;
  default_hours_per_sprint: number;
  tasks: Task[];
}

export interface Task {
  id: number;
  allocation_id: number;
  title: string;
  category: TaskCategory;
  start_date: string | null;
  uat_date: string | null;
  estimated_days: number | null;
  story_points: number;
  status: TaskStatus;
  jira_issue_key: string | null;
}

export interface SprintDetail extends Sprint {
  allocations: Allocation[];
}

export interface SprintInput {
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  status?: SprintStatus;
}

export interface AllocationInput {
  sprint_id: number;
  resource_id: number;
  team: string;
  story_points?: number;
  standard_hours?: number;
  leave_days?: number;
  effective_hours?: number;
  effective_hours_overridden?: boolean;
  dependencies?: string;
  remarks?: string;
}

export interface TaskInput {
  allocation_id: number;
  title: string;
  category?: TaskCategory;
  start_date?: string | null;
  uat_date?: string | null;
  estimated_days?: number | null;
  story_points?: number;
  status?: TaskStatus;
  jira_issue_key?: string | null;
}

export interface ImportPayload {
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  allocations: {
    team: string;
    resource: { name: string; role?: ResourceRole; default_hours_per_sprint?: number };
    story_points: number;
    standard_hours: number;
    leave_days: number;
    dependencies?: string;
    remarks?: string;
    tasks?: {
      title: string;
      start_date?: string | null;
      estimated_days?: number | null;
      story_points?: number;
      category?: TaskCategory;
      status?: TaskStatus;
    }[];
  }[];
}

export interface SprintPlanTaskInput {
  owner: string;
  title: string;
  start_date?: string | null;
  uat_date?: string | null;
  estimated_days?: number | null;
  category?: TaskCategory;
  remarks?: string | null;
}

export interface ImportSprintPlanPayload {
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  tasks: SprintPlanTaskInput[];
}

export interface ActionResult<T> {
  data?: T;
  error?: string;
}

export async function listActiveResourcesByTeam(): Promise<ActionResult<Record<string, Resource[]>>> {
  const result = await listResources();
  if (result.error) return { error: result.error };
  const grouped: Record<string, Resource[]> = {};
  for (const r of (result.data || []).filter((r) => r.is_active)) {
    if (!grouped[r.team]) grouped[r.team] = [];
    grouped[r.team].push(r);
  }
  return { data: grouped };
}

function computeEffectiveHours(standardHours: number, leaveDays: number): number {
  const defaultDayHours = standardHours > 0 ? standardHours / 10 : 8;
  return Math.max(0, standardHours - leaveDays * defaultDayHours);
}

interface QueryRunner {
  query<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

/**
 * Block any sprint whose [start, end] range overlaps an existing sprint.
 * Only enforced when both dates are present (open-ended ranges can't overlap-
 * test reliably and the legacy allocation row has a null end date). Throws an
 * Error with a human-readable message naming the conflicting sprint(s).
 */
async function assertNoOverlap(
  runner: QueryRunner,
  opts: { start: string | null; end: string | null; excludeSprintId?: number }
): Promise<void> {
  if (!opts.start || !opts.end) return;
  const params: unknown[] = [opts.start, opts.end];
  let exclude = "";
  if (opts.excludeSprintId != null) {
    params.push(opts.excludeSprintId);
    exclude = `AND id <> $3`;
  }
  const result = await runner.query<{ id: number; name: string; start_date: string; end_date: string }>(
    `SELECT id, name, start_date, end_date
       FROM sprints
      WHERE start_date IS NOT NULL AND end_date IS NOT NULL
        AND start_date <= $2 AND end_date >= $1
        ${exclude}
      ORDER BY start_date
      LIMIT 3`,
    params
  );
  if (result.rows.length > 0) {
    const names = result.rows.map((r) => `"${r.name}"`).join(", ");
    throw new Error(`Sprint dates overlap existing sprint(s): ${names}. Adjust the dates or attach to that sprint.`);
  }
}

export interface SprintMatch {
  sprint: Sprint;
  matched: boolean; // true = reused an existing sprint, false = created new
}

/**
 * Resolve the target sprint for an import: reuse an existing sprint matched by
 * case-insensitive name, else create one from the parsed dates. Overlap is
 * validated only when creating a new sprint (an existing match is, by
 * definition, already the sprint these dates belong to).
 */
async function findOrCreateSprint(
  runner: QueryRunner,
  input: { name: string; start_date?: string | null; end_date?: string | null }
): Promise<SprintMatch> {
  const name = input.name.trim();
  const existing = await runner.query<Sprint>(
    "SELECT * FROM sprints WHERE LOWER(name) = LOWER($1) ORDER BY id LIMIT 1",
    [name]
  );
  if (existing.rows[0]) {
    return { sprint: existing.rows[0], matched: true };
  }
  await assertNoOverlap(runner, { start: input.start_date || null, end: input.end_date || null });
  const created = await runner.query<Sprint>(
    `INSERT INTO sprints (name, start_date, end_date, status)
     VALUES ($1, $2, $3, 'planning') RETURNING *`,
    [name, input.start_date || null, input.end_date || null]
  );
  return { sprint: created.rows[0], matched: false };
}

export async function listSprints(
  status?: SprintStatus | "all"
): Promise<ActionResult<SprintListItem[]>> {
  try {
    let where = "";
    const params: unknown[] = [];
    if (status && status !== "all") {
      where = "WHERE s.status = $1";
      params.push(status);
    }
    const rows = await query<SprintListItem>(
      `SELECT s.*,
              COUNT(a.id)::int AS resource_count,
              COALESCE(SUM(a.story_points), 0)::float AS total_story_points
       FROM sprints s
       LEFT JOIN sprint_allocations a ON a.sprint_id = s.id
       ${where}
       GROUP BY s.id
       ORDER BY s.created_at DESC`,
      params
    );
    return { data: rows };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

const queryRunner: QueryRunner = {
  query: async (text, params) => ({ rows: await query(text, params) }),
};

export async function createSprint(input: SprintInput): Promise<ActionResult<Sprint>> {
  if (!input.name?.trim()) return { error: "Sprint name is required" };
  try {
    await assertNoOverlap(queryRunner, {
      start: input.start_date || null,
      end: input.end_date || null,
    });
    const row = await queryOne<Sprint>(
      `INSERT INTO sprints (name, start_date, end_date, status)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [input.name.trim(), input.start_date || null, input.end_date || null, input.status || "planning"]
    );
    return { data: row || undefined };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function updateSprint(
  id: number,
  input: Partial<SprintInput>
): Promise<ActionResult<Sprint>> {
  try {
    // When dates change, validate the resulting [start, end] range against
    // other sprints (excluding this one).
    if (input.start_date !== undefined || input.end_date !== undefined) {
      const current = await queryOne<Sprint>("SELECT * FROM sprints WHERE id = $1", [id]);
      if (!current) return { error: "Sprint not found" };
      const nextStart = input.start_date !== undefined ? input.start_date || null : current.start_date;
      const nextEnd = input.end_date !== undefined ? input.end_date || null : current.end_date;
      await assertNoOverlap(queryRunner, { start: nextStart, end: nextEnd, excludeSprintId: id });
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) {
      if (!input.name.trim()) return { error: "Sprint name is required" };
      sets.push(`name = $${idx++}`);
      values.push(input.name.trim());
    }
    if (input.start_date !== undefined) {
      sets.push(`start_date = $${idx++}`);
      values.push(input.start_date || null);
    }
    if (input.end_date !== undefined) {
      sets.push(`end_date = $${idx++}`);
      values.push(input.end_date || null);
    }
    if (input.status !== undefined) {
      sets.push(`status = $${idx++}`);
      values.push(input.status);
    }
    if (sets.length === 0) return { error: "Nothing to update" };

    sets.push(`updated_at = NOW()`);
    values.push(id);

    const row = await queryOne<Sprint>(
      `UPDATE sprints SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!row) return { error: "Sprint not found" };
    return { data: row };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function getSprint(id: number): Promise<ActionResult<SprintDetail>> {
  try {
    const sprint = await queryOne<Sprint>("SELECT * FROM sprints WHERE id = $1", [id]);
    if (!sprint) return { error: "Sprint not found" };

    const allocations = await query<Allocation>(
      `SELECT a.*,
              r.name AS resource_name,
              r.role AS resource_role,
              r.default_hours_per_sprint
       FROM sprint_allocations a
       JOIN resources r ON r.id = a.resource_id
       WHERE a.sprint_id = $1
       ORDER BY a.team, r.name`,
      [id]
    );

    const allocationIds = allocations.map((a) => a.id);
    const tasks: Task[] = allocationIds.length
      ? await query<Task>(
          `SELECT * FROM allocation_tasks WHERE allocation_id = ANY($1::int[]) ORDER BY id`,
          [allocationIds]
        )
      : [];

    const tasksByAllocation = new Map<number, Task[]>();
    for (const t of tasks) {
      const list = tasksByAllocation.get(t.allocation_id) || [];
      list.push(t);
      tasksByAllocation.set(t.allocation_id, list);
    }

    return {
      data: {
        ...sprint,
        allocations: allocations.map((a) => ({
          ...a,
          tasks: tasksByAllocation.get(a.id) || [],
        })),
      },
    };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function createAllocation(
  input: AllocationInput
): Promise<ActionResult<Allocation>> {
  if (!input.sprint_id || !input.resource_id || !input.team?.trim()) {
    return { error: "Sprint, resource, and team are required" };
  }
  const standardHours = input.standard_hours ?? 0;
  const leaveDays = input.leave_days ?? 0;
  const effectiveHours = input.effective_hours_overridden
    ? input.effective_hours ?? 0
    : computeEffectiveHours(standardHours, leaveDays);

  try {
    const row = await queryOne<Allocation>(
      `INSERT INTO sprint_allocations
         (sprint_id, resource_id, team, story_points, standard_hours, leave_days,
          effective_hours, effective_hours_overridden, dependencies, remarks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (sprint_id, resource_id) DO UPDATE SET
         team = EXCLUDED.team,
         story_points = EXCLUDED.story_points,
         standard_hours = EXCLUDED.standard_hours,
         leave_days = EXCLUDED.leave_days,
         effective_hours = EXCLUDED.effective_hours,
         effective_hours_overridden = EXCLUDED.effective_hours_overridden,
         dependencies = EXCLUDED.dependencies,
         remarks = EXCLUDED.remarks,
         updated_at = NOW()
       RETURNING *,
         (SELECT name FROM resources WHERE id = sprint_allocations.resource_id) AS resource_name,
         (SELECT role FROM resources WHERE id = sprint_allocations.resource_id) AS resource_role,
         (SELECT default_hours_per_sprint FROM resources WHERE id = sprint_allocations.resource_id) AS default_hours_per_sprint`,
      [
        input.sprint_id,
        input.resource_id,
        input.team.trim(),
        input.story_points ?? 0,
        standardHours,
        leaveDays,
        effectiveHours,
        input.effective_hours_overridden ?? false,
        input.dependencies || null,
        input.remarks || null,
      ]
    );
    if (!row) return { error: "Failed to create allocation" };
    return { data: { ...row, tasks: [] } };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function updateAllocation(
  id: number,
  input: Partial<{
    story_points?: number;
    standard_hours?: number;
    leave_days?: number;
    effective_hours?: number;
    effective_hours_overridden?: boolean;
    dependencies?: string | null;
    remarks?: string | null;
  }>
): Promise<ActionResult<Allocation>> {
  try {
    const current = await queryOne<Allocation>(
      `SELECT a.*,
              r.name AS resource_name,
              r.role AS resource_role,
              r.default_hours_per_sprint
       FROM sprint_allocations a
       JOIN resources r ON r.id = a.resource_id
       WHERE a.id = $1`,
      [id]
    );
    if (!current) return { error: "Allocation not found" };

    const standardHours = input.standard_hours ?? current.standard_hours;
    const leaveDays = input.leave_days ?? current.leave_days;
    const overridden =
      input.effective_hours_overridden !== undefined
        ? input.effective_hours_overridden
        : current.effective_hours_overridden;
    const effectiveHours =
      overridden
        ? (input.effective_hours ?? current.effective_hours)
        : computeEffectiveHours(standardHours, leaveDays);

    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.story_points !== undefined) {
      sets.push(`story_points = $${idx++}`);
      values.push(input.story_points);
    }
    if (input.standard_hours !== undefined) {
      sets.push(`standard_hours = $${idx++}`);
      values.push(input.standard_hours);
    }
    if (input.leave_days !== undefined) {
      sets.push(`leave_days = $${idx++}`);
      values.push(input.leave_days);
    }
    sets.push(`effective_hours = $${idx++}`);
    values.push(effectiveHours);
    sets.push(`effective_hours_overridden = $${idx++}`);
    values.push(overridden);
    if (input.dependencies !== undefined) {
      sets.push(`dependencies = $${idx++}`);
      values.push(input.dependencies || null);
    }
    if (input.remarks !== undefined) {
      sets.push(`remarks = $${idx++}`);
      values.push(input.remarks || null);
    }

    sets.push(`updated_at = NOW()`);
    values.push(id);

    const row = await queryOne<Allocation>(
      `UPDATE sprint_allocations a SET ${sets.join(", ")}
       FROM resources r
       WHERE a.id = $${idx} AND r.id = a.resource_id
       RETURNING a.*, r.name AS resource_name, r.role AS resource_role, r.default_hours_per_sprint`,
      values
    );
    if (!row) return { error: "Allocation not found" };
    return { data: { ...row, tasks: current.tasks } };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function deleteAllocation(id: number): Promise<ActionResult<{ id: number }>> {
  try {
    await query("DELETE FROM sprint_allocations WHERE id = $1", [id]);
    return { data: { id } };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function createTask(input: TaskInput): Promise<ActionResult<Task>> {
  if (!input.allocation_id || !input.title?.trim()) {
    return { error: "Allocation and title are required" };
  }
  try {
    const row = await queryOne<Task>(
      `INSERT INTO allocation_tasks
         (allocation_id, title, category, start_date, uat_date, estimated_days, story_points, status, jira_issue_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        input.allocation_id,
        input.title.trim(),
        input.category || "product",
        input.start_date || null,
        input.uat_date || null,
        input.estimated_days ?? null,
        input.story_points ?? 0,
        input.status || "todo",
        input.jira_issue_key || null,
      ]
    );
    return { data: row || undefined };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function updateTask(
  id: number,
  input: Partial<TaskInput>
): Promise<ActionResult<Task>> {
  try {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.title !== undefined) {
      if (!input.title.trim()) return { error: "Title is required" };
      sets.push(`title = $${idx++}`);
      values.push(input.title.trim());
    }
    if (input.category !== undefined) {
      sets.push(`category = $${idx++}`);
      values.push(input.category);
    }
    if (input.start_date !== undefined) {
      sets.push(`start_date = $${idx++}`);
      values.push(input.start_date || null);
    }
    if (input.uat_date !== undefined) {
      sets.push(`uat_date = $${idx++}`);
      values.push(input.uat_date || null);
    }
    if (input.estimated_days !== undefined) {
      sets.push(`estimated_days = $${idx++}`);
      values.push(input.estimated_days ?? null);
    }
    if (input.story_points !== undefined) {
      sets.push(`story_points = $${idx++}`);
      values.push(input.story_points);
    }
    if (input.status !== undefined) {
      sets.push(`status = $${idx++}`);
      values.push(input.status);
    }
    if (input.jira_issue_key !== undefined) {
      sets.push(`jira_issue_key = $${idx++}`);
      values.push(input.jira_issue_key || null);
    }
    if (sets.length === 0) return { error: "Nothing to update" };

    sets.push(`updated_at = NOW()`);
    values.push(id);

    const row = await queryOne<Task>(
      `UPDATE allocation_tasks SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!row) return { error: "Task not found" };
    return { data: row };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function deleteTask(id: number): Promise<ActionResult<{ id: number }>> {
  try {
    await query("DELETE FROM allocation_tasks WHERE id = $1", [id]);
    return { data: { id } };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

/**
 * Import a Resource Allocation capacity file. Attaches resources + allocations
 * to a sprint resolved by name (created if missing) — it never creates a
 * standalone "Resource Allocation" sprint row. Allocations upsert on
 * (sprint_id, resource_id), so capacity fills in over any zero-capacity
 * placeholder rows a prior sprint-plan import created, without touching tasks.
 */
export async function importAllocation(
  payload: ImportPayload
): Promise<ActionResult<SprintDetail & { matched: boolean }>> {
  if (!payload.name?.trim()) return { error: "Sprint name is required" };
  if (!payload.allocations?.length) return { error: "No allocations to import" };

  try {
    return await withTransaction(async (client) => {
      const { sprint, matched } = await findOrCreateSprint(client, {
        name: payload.name,
        start_date: payload.start_date,
        end_date: payload.end_date,
      });

      const resourceNameToId = new Map<string, number>();
      for (const alloc of payload.allocations) {
        const name = alloc.resource.name.trim().replace(/\s+/g, " ");
        if (!name) continue;

        let resourceId = resourceNameToId.get(name);
        if (!resourceId) {
          const existing = await client.query<Resource>(
            "SELECT id, is_active FROM resources WHERE LOWER(name) = LOWER($1)",
            [name]
          );
          if (existing.rows[0]) {
            resourceId = existing.rows[0].id;
            if (!existing.rows[0].is_active) {
              await client.query(
                "UPDATE resources SET is_active = true, updated_at = NOW() WHERE id = $1",
                [resourceId]
              );
            }
          } else {
            const created = await client.query<Resource>(
              `INSERT INTO resources (name, team, role, default_hours_per_sprint)
               VALUES ($1, $2, $3, $4) RETURNING id`,
              [
                name,
                alloc.team.trim() || "Unassigned",
                alloc.resource.role || "developer",
                alloc.resource.default_hours_per_sprint ?? alloc.standard_hours ?? 80,
              ]
            );
            resourceId = created.rows[0].id;
          }
          resourceNameToId.set(name, resourceId);
        }

        const standardHours = alloc.standard_hours ?? 0;
        const leaveDays = alloc.leave_days ?? 0;
        const effectiveHours = computeEffectiveHours(standardHours, leaveDays);

        const allocResult = await client.query<Allocation>(
          `INSERT INTO sprint_allocations
             (sprint_id, resource_id, team, story_points, standard_hours, leave_days,
              effective_hours, effective_hours_overridden, dependencies, remarks)
           VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9)
           ON CONFLICT (sprint_id, resource_id) DO UPDATE SET
             team = EXCLUDED.team,
             story_points = EXCLUDED.story_points,
             standard_hours = EXCLUDED.standard_hours,
             leave_days = EXCLUDED.leave_days,
             effective_hours = EXCLUDED.effective_hours,
             effective_hours_overridden = false,
             dependencies = EXCLUDED.dependencies,
             remarks = EXCLUDED.remarks,
             updated_at = NOW()
           RETURNING *,
             (SELECT name FROM resources WHERE id = sprint_allocations.resource_id) AS resource_name,
             (SELECT role FROM resources WHERE id = sprint_allocations.resource_id) AS resource_role,
             (SELECT default_hours_per_sprint FROM resources WHERE id = sprint_allocations.resource_id) AS default_hours_per_sprint`,
          [
            sprint.id,
            resourceId,
            alloc.team.trim() || "Unassigned",
            alloc.story_points ?? 0,
            standardHours,
            leaveDays,
            effectiveHours,
            alloc.dependencies || null,
            alloc.remarks || null,
          ]
        );
        const allocation = allocResult.rows[0];

        for (const task of alloc.tasks || []) {
          await client.query(
            `INSERT INTO allocation_tasks
               (allocation_id, title, category, start_date, estimated_days, story_points, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              allocation.id,
              task.title.trim(),
              task.category || "product",
              task.start_date || null,
              task.estimated_days ?? null,
              task.story_points ?? 0,
              task.status || "todo",
            ]
          );
        }
      }

      const allocations = await client.query<Allocation>(
        `SELECT a.*,
                r.name AS resource_name,
                r.role AS resource_role,
                r.default_hours_per_sprint
         FROM sprint_allocations a
         JOIN resources r ON r.id = a.resource_id
         WHERE a.sprint_id = $1
         ORDER BY a.team, r.name`,
        [sprint.id]
      );

      return {
        data: {
          ...sprint,
          matched,
          allocations: allocations.rows.map((a) => ({ ...a, tasks: [] })),
        },
      };
    });
  } catch (error) {
    return { error: (error as Error).message };
  }
}

/** Back-compat alias during the import cutover. */
export const importSprint = importAllocation;

/**
 * Import a Sprint plan file: sprint name/dates + a task list with owners and
 * UAT dates. Resolves the sprint by name (created if missing), and for each
 * task owner ensures a resource and a zero-capacity *placeholder* allocation
 * exists — using ON CONFLICT DO NOTHING so a later (or earlier) Resource
 * Allocation import owns the real capacity numbers. Tasks attach to that
 * allocation. Safe in either upload order.
 */
export async function importSprintPlan(
  payload: ImportSprintPlanPayload
): Promise<ActionResult<SprintDetail & { matched: boolean; newResources: string[] }>> {
  if (!payload.name?.trim()) return { error: "Sprint name is required" };
  if (!payload.tasks?.length) return { error: "No tasks to import" };

  try {
    return await withTransaction(async (client) => {
      const { sprint, matched } = await findOrCreateSprint(client, {
        name: payload.name,
        start_date: payload.start_date,
        end_date: payload.end_date,
      });

      const newResources: string[] = [];
      const allocByResource = new Map<number, number>(); // resourceId -> allocationId

      for (const task of payload.tasks) {
        const owner = task.owner?.trim().replace(/\s+/g, " ");
        const title = task.title?.trim();
        if (!owner || !title) continue;

        // Resolve / create the resource.
        let resourceId: number;
        const existing = await client.query<Resource>(
          "SELECT id, is_active FROM resources WHERE LOWER(name) = LOWER($1)",
          [owner]
        );
        if (existing.rows[0]) {
          resourceId = existing.rows[0].id;
          if (!existing.rows[0].is_active) {
            await client.query(
              "UPDATE resources SET is_active = true, updated_at = NOW() WHERE id = $1",
              [resourceId]
            );
          }
        } else {
          const created = await client.query<Resource>(
            `INSERT INTO resources (name, team, role, default_hours_per_sprint)
             VALUES ($1, 'Unassigned', 'developer', 80) RETURNING id`,
            [owner]
          );
          resourceId = created.rows[0].id;
          newResources.push(owner);
        }

        // Ensure a placeholder allocation exists WITHOUT overwriting capacity.
        let allocationId = allocByResource.get(resourceId);
        if (!allocationId) {
          await client.query(
            `INSERT INTO sprint_allocations
               (sprint_id, resource_id, team, story_points, standard_hours, leave_days,
                effective_hours, effective_hours_overridden)
             VALUES ($1, $2, 'Unassigned', 0, 0, 0, 0, false)
             ON CONFLICT (sprint_id, resource_id) DO NOTHING`,
            [sprint.id, resourceId]
          );
          const allocRow = await client.query<{ id: number }>(
            "SELECT id FROM sprint_allocations WHERE sprint_id = $1 AND resource_id = $2",
            [sprint.id, resourceId]
          );
          allocationId = allocRow.rows[0].id;
          allocByResource.set(resourceId, allocationId);
        }

        await client.query(
          `INSERT INTO allocation_tasks
             (allocation_id, title, category, start_date, uat_date, estimated_days, story_points, status)
           VALUES ($1, $2, $3, $4, $5, $6, 0, 'todo')`,
          [
            allocationId,
            title,
            task.category || "product",
            task.start_date || null,
            task.uat_date || null,
            task.estimated_days ?? null,
          ]
        );
      }

      const allocations = await client.query<Allocation>(
        `SELECT a.*,
                r.name AS resource_name,
                r.role AS resource_role,
                r.default_hours_per_sprint
         FROM sprint_allocations a
         JOIN resources r ON r.id = a.resource_id
         WHERE a.sprint_id = $1
         ORDER BY a.team, r.name`,
        [sprint.id]
      );

      return {
        data: {
          ...sprint,
          matched,
          newResources,
          allocations: allocations.rows.map((a) => ({ ...a, tasks: [] })),
        },
      };
    });
  } catch (error) {
    return { error: (error as Error).message };
  }
}
