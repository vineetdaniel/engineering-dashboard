# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

CTO Dash is a fintech engineering command center. It aggregates signals from GitHub, Jira Cloud, Datadog/New Relic, cloud billing, compliance tools, and more, then renders them in a Next.js dashboard backed by a FastAPI API.

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Recharts
- **Backend:** FastAPI (Python 3.11), SQLAlchemy, PostgreSQL
- **MCP server:** Python MCP SDK exposing `health_check`, `sync_source`, and `get_metrics` tools
- **Cache / jobs:** Redis + Celery
- **Local infrastructure:** Docker Compose (PostgreSQL + Redis + backend container)

## Common development commands

Run these from the repository root unless noted.

### Full local stack

```bash
# 1. Copy environment template and fill in credentials you want to test
# Real connectors fall back to seed data when credentials are empty.
cp .env.example .env

# 2. Start PostgreSQL and Redis
docker-compose up -d

# 3. Backend (in a separate shell with the venv activated)
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.api.main:app --reload --port 8000

# 4. Frontend (in a separate shell)
cd frontend
npm install
npm run dev
```

### Frontend only

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
npm run build    # production build; must pass clean before merging
npm run lint     # next lint
```

### Backend only

```bash
source .venv/bin/activate
uvicorn backend.api.main:app --reload --port 8000

# Run the MCP server standalone
python -m backend.mcp.server

# Run a Celery worker
 celery -A backend.tasks.celery worker --loglevel=info
```

### Database / seeding

The API auto-seeds on startup when `metrics` and `events` tables are empty. To force a reseed:

```bash
curl -X POST http://localhost:8000/seed?force=true
```

### Validation

- Frontend build and lint are enforced in CI (`.github/workflows/ci.yml`).
- Backend compile check: `python -m compileall backend`

There is no test suite yet; rely on `npm run build` and `python -m compileall backend` for quick validation.

## High-level architecture

### Frontend

- `frontend/app/page.tsx` is the single server-rendered page. It fetches settings, connector health, metrics, and events in parallel and passes them to `DashboardClient`.
- `frontend/components/DashboardClient.tsx` is the client shell. It handles section routing, global filters, live refresh every 60 seconds, and sync actions.
- Sections are rendered dynamically based on the `section` URL query parameter. Valid sections: `overview`, `engineering`, `product`, `operations`, `payments`, `security`, `compliance`, `cost`, `team`, `settings`.
- Each section receives a shared `SectionProps` interface defined in `frontend/components/sections/types.ts`.
- Sections compose widgets from `frontend/components/widgets/`. Shared UI primitives live in `frontend/components/ui/` (shadcn/ui) and `frontend/components/Widget.tsx`.
- `frontend/lib/api.ts` is the single place all API calls are made. Server-side it uses `BACKEND_URL`; client-side it uses `NEXT_PUBLIC_API_URL`, both defaulting to `http://localhost:8000`.

### Backend API

- Entry point: `backend.api.main:app`.
- Lifespan handler creates tables (`init_db`) and seeds empty databases (`seed_if_empty`).
- Key routes:
  - `GET /health` and `GET /health/live` — API liveness + DB latency + connector status + active incidents.
  - `GET /settings` — app settings and configured connectors.
  - `GET /connectors/health` — connector health checks.
  - `GET /settings/connectors` and `GET /settings/connectors/{name}/guide` — connector config UI helpers.
  - `POST /settings/connectors/{name}` — save connector config (secrets are masked in responses).
  - `POST /sync/{source}` — fetch metrics/events from a connector and replace all previous data for that source.
  - `GET /metrics` and `GET /events` — filtered lists; support `source`, `metric_type`/`event_type`, `dateRange` (`24h`, `7d`, `30d`, `90d`), `squad`, and `environment`.
  - `GET /events/stream` — Server-Sent Events feed of incidents/alerts.
  - `POST /seed` — force reseed.

### Data model

- `backend/db/models.py` defines three tables:
  - `Metric` — time-series values (`source`, `metric_type`, `entity`, `value`, `value_text`, `meta` JSON, `timestamp`).
  - `Event` — discrete events (`source`, `event_type`, `entity`, `title`, `severity`, `status`, `meta` JSON, `happened_at`).
  - `ConnectorConfig` — per-connector JSON config overrides.
- Both `Metric` and `Event` have an `is_seed` flag so seeded data can be distinguished from real syncs.

### Connector architecture

- `backend/mcp/integrations/base.py` defines the `Connector` abstract base class with three methods: `health_check()`, `fetch_metrics()`, and `fetch_events()`.
- `backend/mcp/integrations/__init__.py` registers connectors in the `CONNECTORS` dict: `github`, `jira`, and `observability`.
- `backend/mcp/integrations/observability.py` is a dispatcher that selects Datadog or New Relic based on `OBSERVABILITY_PROVIDER`.
- `backend/config_store.py` layers connector configuration: environment variables provide defaults; per-connector rows in `ConnectorConfig` override them. Secrets are masked before being returned to the frontend.

### MCP server

- `backend/mcp/server.py` exposes three tools over stdio: `health_check`, `sync_source`, and `get_metrics`.
- It reuses the same `CONNECTORS` registry as the FastAPI backend.

### Jobs

- `backend/tasks/celery.py` sets up a Celery app using Redis as broker/backend.
- `backend/tasks/sync.py` provides a Celery task wrapper around connector syncs.

## Important conventions

### Filters

Dashboard filters are consistent across sections:

- `dateRange`: `24h`, `7d`, `30d`, `90d`
- `squad`: `all`, `platform`, `payments`, `data`, `security`
- `environment`: `all`, `prod`, `staging`

Backend filtering checks both the `entity` column and `meta.squad` / `meta.environment` JSON fields using PostgreSQL JSONB containment.

### Widget development

- New widgets should accept `SectionProps` (or a subset) and live in `frontend/components/widgets/`.
- Re-export widgets from `frontend/components/widgets/index.ts` if they need to be imported by other widgets.
- Each section is wrapped in `WidgetErrorBoundary` in `DashboardClient` so a single widget crash does not bring down the page.
- Use `frontend/components/Widget.tsx` for consistent card styling; use `frontend/components/ui/*` for shadcn primitives.

### Connector development

- Add new connectors by subclassing `Connector`, registering them in `CONNECTORS`, and updating `backend/config_store.py` with defaults, required fields, and secret keys.
- Add a setup guide entry in `backend/api/main.py` inside `_GUIDES` if the connector is configurable through the UI.
- Connector health checks must return `{"ok": bool, ...}` so the dashboard status indicator can parse them.

### Sync behavior

`POST /sync/{source}` deletes all existing metrics and events for that source before inserting new data. This makes each sync idempotent but means history for a source is not preserved across syncs.

### Environment / deployment

- The FastAPI backend reads settings from `.env` via Pydantic (`backend/config.py`).
- The frontend is deployed to Vercel; `vercel.json` configures the build command and output directory.
- `docker-compose.yml` is for local infrastructure only; the backend service mounts `./backend` so code changes are reflected without rebuilding the image.

## Key file map

- `backend/api/main.py` — API routes and lifespan.
- `backend/api/schemas.py` — Pydantic response models.
- `backend/db/models.py` — SQLAlchemy models and engine.
- `backend/db/seed.py` — Realistic seed metrics/events for local development.
- `backend/config.py` — Pydantic settings.
- `backend/config_store.py` — Connector config layering and secret masking.
- `backend/mcp/integrations/` — Connector implementations.
- `frontend/app/page.tsx` — Server-rendered dashboard entry.
- `frontend/components/DashboardClient.tsx` — Client dashboard shell.
- `frontend/components/sections/` — Section pages.
- `frontend/components/widgets/` — Reusable metric widgets.
- `frontend/lib/api.ts` — API client.
