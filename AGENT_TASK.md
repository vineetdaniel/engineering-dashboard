# Task: Build Resource Allocation UI for Sprint Planning

## Context

PayMe engineering runs two-week sprints. Each sprint, a PM manually fills an
Excel sheet with: who is in the sprint, their story point capacity, standard
hours, leave days, dependencies, and task-level detail (what each person is
working on, when they start, how many days it takes).

This tool replaces that Excel. The primary user is the PM. The output must be
readable by the CTO/team leads at a glance.

---

## Database

Schema is already applied. The enums are:

```
sprint_status  (planning | active | completed)
task_category  (product | integration | other)
task_status    (todo | in_progress | done)
resource_role  (developer | qa | devops | designer | pm)
```

Do not change column names or add migrations in this task.

---

## Pages

### 1. Sprint list  `/sprints`

- Table: name, date range, status badge, resource count, total story points
- Two buttons in the header: "New sprint" (create modal) and "Import from Excel" (import flow)
- Click any row → Sprint detail page
- Status filter tabs: All | Planning | Active | Completed

### 2. Sprint detail  `/sprints/[id]`

This is the main PM workspace. Three sections on one page.

**Section A — Sprint header**
Editable inline: name, start date, end date, status. Save on blur/change.

**Section B — Allocation table**

One row per resource, grouped by team. Columns:

| Resource | Story Points | Standard Hours | Leave Days | Effective Hours | Dependencies | Remarks | Actions |
|----------|-------------|----------------|------------|-----------------|--------------|---------|---------|

- All numeric cells are inline-editable (click to edit, Enter/blur to save).
- Effective hours is read-only — recomputed on the server after leaves_days or
  standard_hours change. PM can override it by clicking a lock icon that turns
  the cell editable.
- "Add resource" button at the bottom of each team group opens a dropdown of
  active resources not yet in this sprint.
- Row delete removes the allocation and all its tasks (cascade). Confirm with
  a single popconfirm, not a modal.

**Section C — Task drawer**

Clicking a resource row expands an inline task panel below it (not a sidebar).
Task panel columns: Title | Category | Start Date | Est. Days | Story Points | Status | Jira Key | Delete

- "Add task" row appears at the bottom of the panel.
- All fields editable inline, same pattern as the allocation table.
- Category renders as a small pill (product = blue, integration = amber,
  other = gray).
- Status renders as a segmented control: Todo → In Progress → Done.

### 3. Resource manager  `/resources`

Simple CRUD:
- List all resources grouped by team.
- Add resource form: name, team (dropdown), role, default_hours_per_sprint.
- Deactivate toggle (is_active). Deactivated resources disappear from the
  "Add resource" dropdown in sprint detail but their historical allocations remain.

---

## Excel import

### Source file format

The Excel has two relevant sheets.

**Sheet 1 (main allocation sheet)**

- Row 1: Sprint name + date range in one cell. Example: `Resource Allocation- 29th May to 11th June'26`
- Row 2: Headers — Name, Story Points, Standard Hour, Leaves in this Sprint, Dependencies, Remarks If Any
- Subsequent rows alternate between team header rows and resource rows:
  - Team header row: non-empty Name cell, all other cells empty — e.g. `Backend`, `Payme App`
  - Resource row: Name + numeric data

**Sheet 2 (task detail)**

Contains a task tracking block with columns: Resource Name, Task, Start Date, No. of Days Dev Effort

### Import flow

1. PM clicks "Import from Excel" on the sprint list page.
2. File picker opens. Accept `.xlsx` only.
3. Parse the file client-side using `xlsx` (SheetJS). Do not send the raw file to the server.
4. Show a preview screen before committing anything to the DB:

```
┌─────────────────────────────────────────────────────┐
│ Sprint name   [editable]                            │
│ Start date    [editable]   End date   [editable]    │
├─────────────────────────────────────────────────────┤
│ 14 resources found across 3 teams                   │
│                                                     │
│ Backend (8)                                         │
│  ✓ Vishal Gupta      56 SP  56h  1 leave            │
│  ✓ Satish            56 SP  56h  1 leave            │
│  ⚠ Avinash Kumar     — no data rows, skipped        │
│                                                     │
│ Web / Frontend (5)                                  │
│  ✓ Ankit Yadav       48 SP  72h  0 leave            │
│  …                                                  │
│                                                     │
│ Payme App (3)                                       │
│  ✓ Manik Choudhary   40 SP  56h  0 leave            │
│  …                                                  │
├─────────────────────────────────────────────────────┤
│ 9 tasks found in Sheet 2                            │
│  Vishal Gupta → "Reporting system from legacy..."   │
│  Satish Pandey → "LPL BRE"                          │
│  …                                                  │
├─────────────────────────────────────────────────────┤
│  [Cancel]                        [Confirm import]   │
└─────────────────────────────────────────────────────┘
```

5. PM can edit sprint name and dates in the preview before confirming.
6. On confirm, a single server action creates: sprint → allocations → tasks in one transaction.
7. On success, redirect to the new sprint's detail page.

### Parsing rules

**Sprint name and dates**

- Extract from the first non-empty cell of Sheet 1, row 1.
- Parse the date range from the string using a regex that handles ordinals and short month names.
  Example: `29th May to 11th June'26` → `start_date: 2026-05-29`, `end_date: 2026-06-11`
- If parsing fails, leave start_date and end_date blank — PM fills them in the preview.
- Use the full cell value as the sprint name, trimmed.

**Team detection**

- A row is a team header if: the Name cell is non-empty AND story_points, standard_hours,
  and leaves are all empty/null.
- Track the current team as rows are iterated. Assign it to subsequent resource rows until
  the next team header.
- If no team header has been seen yet, assign team name "Unassigned".

**Leaves parsing**

- `leaves in this sprint` values arrive as strings like `"1 Leave"`, `"2 Leave"`, or empty.
- Extract the leading integer. Empty or unparseable → 0.

**Resource matching**

- Normalize names: trim whitespace, collapse internal spaces.
- Look up existing resources by normalized name (case-insensitive).
- If found → reuse. If not found → create with team assignment from the import,
  role defaulting to `developer`, default_hours_per_sprint from the standard_hours
  value in this row.
- Do not deactivate or modify existing resources not in the file.

**Task parsing (Sheet 2)**

- Find the block with headers: Resource Name, Task (or Task- In hand), Start Date,
  No. of Days Dev Effort. Header detection is fuzzy — match on substring, case-insensitive.
- For each data row: match Resource Name to an allocation created in this import
  (same normalized name lookup). Skip rows where the resource is not found.
- `start_date`: parse common Indian date formats — `28th May 2026`, `3rd June`,
  `29th June 2026`. If day/month only, assume the sprint's year.
- `estimated_days`: integer. Blank or unparseable → null.
- `category`: default to `product`. If the task text contains words like
  "integration", "API", "SDK", "webhook" → set `integration`.
- `status`: default to `todo`.
- Sheet 2 also contains an informal "in-hand" list (resource name + short task label
  in a loose two-column block above the main table). Parse this block too.
  Same rules apply; estimated_days will be null for these rows.

**Skipped rows**

- Rows where Name is empty → skip silently.
- Rows where Name is a known header value ("Backend", "Payme App", etc.) → treat as
  team header, not resource.
- Rows where Name is non-empty but all numeric fields are zero/null and there is no
  remarks or dependencies text → flag as warning in the preview, do not import.

### Error handling

- If SheetJS fails to parse the file, show an inline error: "Could not read file.
  Confirm it is a .xlsx export from Excel or Google Sheets."
- Individual row parse failures are warnings in the preview, not blockers.
- If the server action transaction fails, show the error inline on the preview screen.
  Do not redirect. PM can retry without re-uploading the file.

---

## Data layer

One file per domain. Validate input before touching the DB. Return `{ data, error }` — never throw to the client. Invalidate/revalidate affected pages after mutations.

---

## Acceptance criteria

1. PM can create a sprint with name and date range in under 5 clicks.
2. PM can add a resource to a sprint and set story points, hours, and leaves
   without leaving the page.
3. Effective hours updates automatically when standard hours or leaves change.
4. PM can expand any resource row and add/edit/delete tasks inline.
5. Sprint summary (story points per team, effective hours per resource) is
   visible without scrolling on a 1440px screen.
6. All form inputs validate before submit. Errors appear inline, not as toasts.
7. Deactivated resources do not appear in "Add resource" dropdowns.
8. Deleting an allocation deletes all its tasks. PM sees a confirm step first.
9. Page reloads (F5) return the user to the same sprint detail page with all
   data intact — no loading spinners longer than 300ms.
10. Mobile: Sprint list and resource manager are usable. Sprint detail degrades
    to a scrollable table — no horizontal scroll on resource name or story points
    columns.
11. Uploading the reference Excel file (`Resource_Allocation_29th_May_to_11th_June.xlsx`)
    produces a preview with 14 resource rows across 3 teams and 9+ task rows, with no
    JS errors in the console.
12. PM can edit sprint name and dates in the preview before confirming import.
13. Re-importing the same file does not duplicate resources. It creates a new sprint
    with new allocations pointing to existing resource records.

---

## Sprint detail layout (1440px reference)

```
┌─────────────────────────────────────────────────────────────────┐
│ Sprint name [editable]        29 May – 11 Jun  ● Active    Save │
├───────────────────┬──────────────────────────────────────────────┤
│ Summary cards     │  Backend (6)   SP: 340   Eff hrs: 336       │
│ (right of header) │  Web (5)       SP: 295   Eff hrs: 280       │
│                   │  Payme App (3) SP: 124   Eff hrs: 200       │
├───────────────────┴──────────────────────────────────────────────┤
│ [Backend]                                                        │
│  Vishal Gupta  56  56  1  48  [deps...]  [remarks...]  ⊕ ✕      │
│    ↳ task panel (expanded)                                       │
│  Satish        56  56  1  48  ...                                │
│  [+ Add resource to Backend]                                     │
├──────────────────────────────────────────────────────────────────┤
│ [Web / Frontend]   ...                                           │
│ [Payme App]        ...                                           │
└──────────────────────────────────────────────────────────────────┘
```

---

## Build order

1. Resource manager page — simplest CRUD, validates the full data layer end-to-end.
2. Sprint list page + create modal.
3. Sprint detail — header + allocation table (read + inline edit).
4. Effective hours: after saving leaves_days or standard_hours, confirm effective_hours recomputes correctly on next read.
5. Task panel — expand/collapse + inline CRUD.
6. Summary cards above the allocation table.
7. Excel import — parser + preview screen + confirm action.
8. Mobile responsive pass.

---

## Notes

- Do not build authentication in this phase. Single-user, no session.
- Do not build Jira sync. The `jira_issue_key` field is a free-text input only.
- The `dependencies` and `remarks` columns in the allocation table hold plain
  text from the PM. No linking logic required.
- `effective_hours` override path (lock icon → editable cell) is a PM escape
  hatch for partial leave days. Store the overridden value directly; the
  server action skips the recompute if the client passes `override: true`.
- Excel parsing happens entirely client-side. The server action for import
  receives clean JSON — not a file buffer.
