"use server";

import { query, queryOne, withTransaction } from "@/lib/db";

export type ResourceRole = "developer" | "qa" | "devops" | "designer" | "pm";

export interface Resource {
  id: number;
  name: string;
  team: string;
  role: ResourceRole;
  default_hours_per_sprint: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResourceInput {
  name: string;
  team: string;
  role: ResourceRole;
  default_hours_per_sprint: number;
}

export interface ActionResult<T> {
  data?: T;
  error?: string;
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export async function listResources(): Promise<ActionResult<Resource[]>> {
  try {
    const rows = await query<Resource>(
      "SELECT * FROM resources ORDER BY team, name"
    );
    return { data: rows };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function listActiveResourcesByTeam(): Promise<ActionResult<Record<string, Resource[]>>> {
  try {
    const rows = await query<Resource>(
      "SELECT * FROM resources WHERE is_active = true ORDER BY team, name"
    );
    const grouped: Record<string, Resource[]> = {};
    for (const r of rows) {
      if (!grouped[r.team]) grouped[r.team] = [];
      grouped[r.team].push(r);
    }
    return { data: grouped };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function createResource(input: ResourceInput): Promise<ActionResult<Resource>> {
  const name = normalizeName(input.name);
  if (!name) return { error: "Name is required" };
  if (!input.team) return { error: "Team is required" };
  if (!input.role) return { error: "Role is required" };

  try {
    const row = await queryOne<Resource>(
      `INSERT INTO resources (name, team, role, default_hours_per_sprint)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE SET
         team = EXCLUDED.team,
         role = EXCLUDED.role,
         default_hours_per_sprint = EXCLUDED.default_hours_per_sprint,
         is_active = true,
         updated_at = NOW()
       RETURNING *`,
      [name, input.team.trim(), input.role, input.default_hours_per_sprint || 80]
    );
    return { data: row || undefined };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function updateResource(
  id: number,
  input: Partial<ResourceInput>
): Promise<ActionResult<Resource>> {
  try {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) {
      const name = normalizeName(input.name);
      if (!name) return { error: "Name is required" };
      sets.push(`name = $${idx++}`);
      values.push(name);
    }
    if (input.team !== undefined) {
      sets.push(`team = $${idx++}`);
      values.push(input.team.trim());
    }
    if (input.role !== undefined) {
      sets.push(`role = $${idx++}`);
      values.push(input.role);
    }
    if (input.default_hours_per_sprint !== undefined) {
      sets.push(`default_hours_per_sprint = $${idx++}`);
      values.push(input.default_hours_per_sprint);
    }
    if (sets.length === 0) return { error: "Nothing to update" };

    sets.push(`updated_at = NOW()`);
    values.push(id);

    const row = await queryOne<Resource>(
      `UPDATE resources SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!row) return { error: "Resource not found" };
    return { data: row };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function toggleResourceActive(id: number): Promise<ActionResult<Resource>> {
  try {
    const row = await queryOne<Resource>(
      "UPDATE resources SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    if (!row) return { error: "Resource not found" };
    return { data: row };
  } catch (error) {
    return { error: (error as Error).message };
  }
}
