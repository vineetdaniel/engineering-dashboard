# Plan: Jira Story Points per Developer, per Sprint, and Backlog Metrics

## Goal
Expose richer Jira story-point data in the dashboard:
1. **Story points per developer per sprint** — breakdown by active sprint and assignee.
2. **Ad-hoc per-developer story points** — currently open/unresolved points owned by each developer.
3. **Backlog story points** — total points of unresolved issues not in an active sprint.

## Files to change

### Backend
- `backend/config.py` — add `JIRA_STORY_POINTS_FIELD` (default `customfield_10016`).
- `backend/config_store.py` — expose `JIRA_STORY_POINTS_FIELD` in Jira connector defaults.
- `backend/mcp/integrations/jira.py` — read the story-point field from config, add three new fetch helpers, and emit new metrics.
- `backend/db/seed.py` — seed realistic metrics for the new metric types so the UI works without real Jira.

### Frontend
- `frontend/components/widgets/DeveloperPointsTable.tsx` — new table widget for ad-hoc developer points.
- `frontend/components/widgets/SprintDeveloperPoints.tsx` — new table widget for sprint-level developer breakdown.
- `frontend/components/widgets/index.ts` — re-export the new widgets.
- `frontend/components/sections/ProductSection.tsx` — wire the new widgets and backlog stat into the Product Delivery section.

## Implementation details

### 1. Configurable story-point field
The current Jira connector hardcodes `customfield_10016`. We will make it configurable via `JIRA_STORY_POINTS_FIELD`, falling back to `customfield_10016` so existing setups keep working.

### 2. New metrics emitted by `JiraConnector.fetch_metrics()`
All metrics use `source="jira"` and `timestamp=utcnow`.

| Metric type | Entity | Value | Meta |
|---|---|---|---|
| `sprint_points_per_developer` | project key | points assigned to that developer in the sprint | `sprint_id`, `sprint_name`, `assignee_login`, `assignee_name`, `project`, `completed_points` |
| `developer_open_story_points` | project key | unresolved points owned by the developer | `assignee_login`, `assignee_name`, `project`, `issue_count` |
| `backlog_story_points` | project key | unresolved points not in active sprints | `issue_count`, `project` |

### 3. JQL / API strategy
- **Per-sprint:** reuse the existing Agile board/sprint discovery, then query `sprint/{id}/issue` with `fields=status,assignee,customfield_10016` (or configured field) and aggregate `total_points` and `done_points` per assignee.
- **Ad-hoc:** `project=X AND resolution = Unresolved AND assignee is not EMPTY`, fields include `assignee` and story-point field, then group by assignee.
- **Backlog:** `project=X AND resolution = Unresolved AND (sprint is EMPTY OR sprint not in openSprints())`, sum story points and count issues.

### 4. Seed data
Add per-squad seed metrics for the three new types with realistic developer names so the Product section renders meaningful tables even when Jira credentials are empty.

### 5. Frontend integration in ProductSection
- Add a new top-level stat card for **Backlog Points** next to Velocity.
- Add a two-column row:
  - `SprintDeveloperPoints` widget showing the active-sprint developer breakdown.
  - `DeveloperPointsTable` widget showing ad-hoc open points per developer.
- Keep the existing sprint burndown / velocity charts and epic progress widgets.

### 6. Widget contracts
- `DeveloperPointsTable`: takes `rows: { login, name, points, issueCount, project? }[]`.
- `SprintDeveloperPoints`: takes `rows: { sprint, developer, points, completedPoints, project? }[]` and groups/renders by sprint.

## Validation
- `python -m compileall backend`
- `cd frontend && npm run build`
- Start the stack and confirm the Product section shows the new Backlog Points stat and the two new tables when seeded data is active.

## Rollback / risk
- The Jira connector still falls back to `customfield_10016`, so real syncs remain compatible.
- New widgets only read new metric types; if metrics are absent they show empty states, not crashes.
- `DashboardClient` wraps each section in `WidgetErrorBoundary`.
