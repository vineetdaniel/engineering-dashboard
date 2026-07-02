# Plan: Resource Allocation UI for Sprint Planning

## Goal
Replace the PM's manual Excel sprint-planning sheet with a web UI where the PM can create sprints, manage resources per sprint, allocate story points/hours/leave, and track per-resource tasks inline.

## Architecture decisions

1. **Next.js server actions + `pg`**
   - The task repeatedly references "server actions" and single-transaction imports.
   - The frontend already runs Next.js 15 App Router, so server actions are native.
   - We will add `pg` (node-postgres) and `xlsx` (SheetJS) to `frontend/package.json`.
   - The same PostgreSQL instance (`ctodash`) will host the new tables; server actions read `DATABASE_URL` from `.env`.

2. **Schema / tables**
   - Create four tables under the existing `public` schema:
     - `resources`
     - `sprints`
     - `sprint_allocations`
     - `allocation_tasks`
   - Use PostgreSQL enums exactly as specified:
     - `sprint_status` (planning | active | completed)
     - `task_category` (product | integration | other)
     - `task_status` (todo | in_progress | done)
     - `resource_role` (developer | qa | devops | designer | pm)
   - A small `ensureTables()` helper runs on first server-action call so the schema is created automatically without migrations.

3. **No authentication / no Jira sync**
   - Per the task spec, this phase is single-user and `jira_issue_key` is free text.

## File layout

```
frontend/
  app/
    sprints/
      page.tsx                 # Sprint list + tabs + import
      [id]/
        page.tsx               # Sprint detail shell
    resources/
      page.tsx                 # Resource manager
  lib/
    db/
      index.ts                 # pg Pool + typed query helper
      schema.ts                # DDL strings + ensureTables()
    actions/
      resources.ts             # CRUD server actions for resources
      sprints.ts               # CRUD + import server actions for sprints/allocation/tasks
    excel/
      parser.ts                # Client-side xlsx parsing helpers
    dates.ts                   # Indian date-format parser for Excel import
  components/
    planning/
      SprintList.tsx           # Table with status filter tabs
      SprintCreateModal.tsx    # Create new sprint
      SprintHeader.tsx         # Editable name/dates/status
      AllocationTable.tsx      # Per-team allocation rows + inline edit
      TaskPanel.tsx            # Expandable task list per resource
      SummaryCards.tsx         # Team SP / effective-hours summary
      ImportDialog.tsx         # Upload + preview
      ImportPreview.tsx        # Review screen before confirm
      ResourceForm.tsx         # Add/edit resource
      ResourceList.tsx         # Grouped resource CRUD
      InlineEdit.tsx           # Reusable click-to-edit cell
      StatusBadge.tsx          # Sprint status badge
      CategoryPill.tsx         # Task category pill
      TaskStatusControl.tsx    # Segmented todo/in_progress/done
```

## Build order & tasks

1. **Install dependencies + DB layer**
   - Add `pg`, `@types/pg`, `xlsx`, `@types/xlsx` (or just `xlsx` with types included) to `frontend/package.json`.
   - Create `frontend/lib/db/index.ts` with a `Pool` from `process.env.DATABASE_URL`.
   - Create `frontend/lib/db/schema.ts` with DDL and `ensureTables()`.

2. **Resource manager (`/resources`)**
   - Server actions: `listResources`, `createResource`, `updateResource`, `toggleResourceActive`.
   - UI: grouped by team, add-resource form, deactivate toggle.
   - Acceptance: deactivated resources do not appear in sprint-detail "Add resource" dropdowns.

3. **Sprint list (`/sprints`)**
   - Server action: `listSprints`.
   - UI: table (name, date range, status badge, resource count, total SP), status tabs (All | Planning | Active | Completed).
   - Create-sprint modal with name + start/end dates.

4. **Sprint detail header + allocation table (`/sprints/[id]`)**
   - Server actions: `getSprint`, `updateSprintHeader`, `createAllocation`, `updateAllocation`, `deleteAllocation`.
   - UI: editable header, grouped allocation table, inline editing for story_points, standard_hours, leave_days, dependencies, remarks.
   - "Add resource" dropdown per team group (active resources not already allocated).
   - Delete allocation with confirmation popconfirm; server action cascades tasks.

5. **Effective hours recompute**
   - `effective_hours = standard_hours - (leave_days * default_day_hours)`.
   - Default day hours = `standard_hours / 10` for a two-week sprint, or use `default_hours_per_sprint` from resource if available.
   - Server action recomputes after `standard_hours` or `leave_days` changes unless client sends `override: true`.
   - Lock icon toggles override mode and makes the cell editable.

6. **Task panel**
   - Expand/collapse per allocation row.
   - Inline add/edit/delete tasks: title, category pill, start date, estimated days, story points, status segmented control, Jira key.
   - Server actions: `createTask`, `updateTask`, `deleteTask`.

7. **Summary cards**
   - Cards above allocation table: per-team SP total + effective hours total.
   - Single-row layout for 1440px screens.

8. **Excel import**
   - Client-side `xlsx` parser in `frontend/lib/excel/parser.ts`.
   - Detect Sheet 1 team headers vs resource rows, parse sprint name + dates, match/create resources by normalized name.
   - Sheet 2 task block parsing with Indian date formats.
   - `ImportDialog` → `ImportPreview` → server action `importSprint(json)` in one transaction.
   - On success, redirect to `/sprints/{id}`.

9. **Navigation + polish**
   - Add a "Planning" item to `frontend/components/Sidebar.tsx` linking to `/sprints`.
   - Mobile responsive pass for sprint list and resource manager; sprint detail degrades to vertical scrollable tables.

## Reports that can be derived from this data

| Report | Dimensions | Use case |
|---|---|---|
| **Sprint capacity vs. allocation** | Team / role / individual | Compare total effective hours/story points committed against available capacity. |
| **Load distribution** | Per developer / per team | Identify over-allocated or under-utilized resources. |
| **Story point velocity** | Sprint-over-sprint | Track completed SP per sprint and per team. |
| **Leave impact** | Sprint / team | Measure how leave days reduce effective capacity. |
| **Task category mix** | product vs integration vs other | See how engineering effort splits across roadmap work vs integration work. |
| **Task completion rate** | Sprint / category / status | Track todo → in_progress → done conversion. |
| **Dependency heatmap** | Resource / sprint | Surface allocations with heavy dependencies that may create blockers. |
| **Historical resource utilization** | Resource / quarter | Aggregate effective hours and SP delivered per resource over time. |
| **Team-wise SP burn** | Team / sprint | Compare committed SP versus completed SP by team. |
| **Jira traceability** | Sprint / task | Cross-check tasks that have a `jira_issue_key` versus those that do not. |

A future reporting page could query the same tables with simple SQL GROUP BY queries, e.g.:

```sql
SELECT s.name AS sprint,
       a.team,
       SUM(a.story_points) AS total_sp,
       SUM(a.effective_hours) AS total_eff_hours,
       COUNT(t.id) FILTER (WHERE t.status = 'done') AS done_tasks
FROM sprints s
JOIN sprint_allocations a ON a.sprint_id = s.id
LEFT JOIN allocation_tasks t ON t.allocation_id = a.id
WHERE s.status = 'completed'
GROUP BY s.name, a.team;
```

## Validation
- `cd frontend && npm install && npm run build` must pass.
- Visit `/resources`, `/sprints`, and `/sprints/{id}` with seeded sample data.
- Upload the reference Excel file and confirm the preview shows 14 resources across 3 teams and 9+ tasks.
- Re-import the same file and confirm resources are not duplicated.

## Risks / decisions made
- We are adding tables to the existing `ctodash` DB. The `ensureTables()` helper creates them only if missing, so it is safe to run against the current local stack.
- The task says "Schema is already applied"; since the tables do not currently exist in the local DB, we create them via the helper.
- We do not change existing CTO Dash tables (metrics/events/connector_configs) at all.
- Excel parsing is client-side; the server receives clean JSON, matching the spec.
