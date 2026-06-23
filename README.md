# cto-dash

A CTO dashboard for a fintech engineering organization.

Aggregates signals from GitHub, Jira Cloud, Datadog (with New Relic support configurable), cloud billing, compliance tools, and more — exposed via a unified MCP server and rendered in a Next.js dashboard.

## Stack

- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui, Tremor, Recharts
- **Backend API:** FastAPI (Python)
- **MCP Server:** Python MCP SDK
- **Database:** PostgreSQL
- **Cache / Jobs:** Redis + Celery
- **Deployment:** Vercel (frontend) + Render/Railway/Fly.io (backend)
- **Local dev:** Docker + docker-compose

## Quick start

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Start local infrastructure
docker-compose up -d

# 3. Install backend dependencies
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

# 4. Run backend
uvicorn backend.api.main:app --reload

# 5. Install frontend dependencies
cd frontend
npm install
npm run dev
```

## Git author

Configured for this repo as: `Vineet Daniel <vineetdaniel@gmail.com>`

## Documentation

- [Dashboard Plan](PLAN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [MCP Connectors](docs/MCP.md)
