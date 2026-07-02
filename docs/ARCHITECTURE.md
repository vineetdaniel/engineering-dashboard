# Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│              Next.js 14 + Tailwind + shadcn/ui              │
│                     (Vercel deploy)                         │
└────────────────────────┬────────────────────────────────────┘
                         │ REST / WebSocket
┌────────────────────────▼────────────────────────────────────┐
│                       FastAPI API                           │
│  /health  /settings  /sync/{source}  /metrics  /events     │
│                    Celery + Redis                            │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   ┌─────────┐     ┌─────────┐     ┌──────────────┐
   │ GitHub  │     │  Jira   │     │ Observability│
   │  MCP    │     │   MCP   │     │ (DD / NR)    │
   └─────────┘     └─────────┘     └──────────────┘
        │                │                │
        └────────────────┴────────────────┘
                         │
              ┌──────────▼──────────┐
              │  PostgreSQL (data)  │
              │  Redis (cache/jobs) │
              └─────────────────────┘
```

## MCP design

Each integration implements the `Connector` base class:

- `health_check()` — validates credentials and basic connectivity.
- `fetch_metrics()` — returns normalized time-series metrics.
- `fetch_events()` — returns discrete events (alerts, incidents, blocked tickets).

The unified MCP server exposes three tools:

1. `health_check`
2. `sync_source`
3. `get_metrics`

Data is persisted in PostgreSQL so dashboards render quickly and history is preserved.
