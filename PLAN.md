# CTO Dashboard Plan — cto-dash

## Goal
Build a single-pane dashboard for a fintech CTO that aggregates engineering, operational, security, product delivery, and financial signals from the tools the team already uses.

## Guiding principles
1. **Single source of truth for CTO-level signals** — not a replacement for individual tools, but a curated aggregation of what a CTO needs to see weekly/daily.
2. **Action-oriented** — every widget should answer: "Is there something I need to act on, escalate, or celebrate?"
3. **Fintech-specific** — emphasize uptime, security, compliance, cost per transaction, and incident response.
4. **Extensible** — start with GitHub + Jira, then plug in other data sources via MCP connectors.

---

## 1. Data Sources & MCP Integration Strategy

### Phase 1: Core engineering (must-have)
| Source | Data to pull | MCP approach |
|--------|-------------|--------------|
| **GitHub** | PRs, commits, review turnaround, open branches, CI/CD status, Dependabot/security alerts, top contributors | Use the official **GitHub MCP server** where available; fall back to REST/GraphQL API wrapper if needed. |
| **Jira** | Sprint velocity, active sprints, blocked tickets, epic progress, bug backlog, cycle time, release issues | Build/customize a **Jira MCP server** using the Jira REST API v3. |

### Phase 2: Operations & observability
| Source | Data to pull | MCP approach |
|--------|-------------|--------------|
| **Datadog / New Relic** | Service health, SLO status, error rates, latency p95/p99, infrastructure alerts | Generic HTTP MCP or custom observability MCP using their APIs. |
| **PagerDuty / Opsgenie** | On-call roster, open incidents, MTTR, escalation policies, alert noise | Custom PagerDuty MCP server. |

### Phase 3: Security, compliance & cost (fintech-critical)
| Source | Data to pull | MCP approach |
|--------|-------------|--------------|
| **GitHub Advanced Security / Dependabot / Snyk** | Open CVEs, severity distribution, time-to-remediate, secrets scanning alerts | GitHub MCP + Snyk REST MCP. |
| **AWS Cost Explorer / GCP Billing** | Daily/weekly cloud spend, cost by service, projected monthly bill, cost-per-transaction | Custom cloud-billing MCP. |
| **Vanta / Drata / custom compliance** | Control status, audit findings, overdue evidence | Custom compliance MCP or CSV/manual data feed. |

### Phase 4: Product & people signals
| Source | Data to pull | MCP approach |
|--------|-------------|--------------|
| **LaunchDarkly / Split** | Active feature flags, stale flags, flag changes | Feature-flag MCP. |
| **Mixpanel / Amplitude** | Key product funnels, error correlation, adoption | Analytics MCP. |
| **Slack (read-only)** | Incident channel activity, sentiment, team mentions | Slack MCP (scope carefully). |
| **HRIS / calendar** | Team PTO, new hires, upcoming 1:1s, hiring pipeline | Calendar/HRIS MCP or manual CSV. |

### Recommended MCP architecture
- A **unified `cto-dash-mcp`** server in the repo that exposes tools/resources for each integration.
- Each integration is a **plugin module** (`github.py`, `jira.py`, `datadog.py`, etc.) with a common interface:
  - `fetch_data()` → raw fetch
  - `transform()` → normalized metric/event
  - `health_check()` → connection/auth validation
- Secrets stored in `.env` or a secrets manager; never committed.
- Use **Model Context Protocol (MCP)** so Codex and other AI assistants can query the dashboard data directly.

---

## 2. Dashboard Layout & Core Widgets

### Top bar
- **Last refreshed** timestamp + manual refresh
- **Global filters**: team/squad, date range, environment (prod/staging), service tag
- **Alert pill**: count of P0/P1 incidents and open critical CVEs

### Section A: Engineering Health (DORA + flow)
- Deployment frequency (per week)
- Lead time for changes (commit → prod)
- Mean time to recovery (MTTR)
- Change failure rate (% of deploys causing incidents)
- Open PRs and median review time
- PRs stuck > 48h
- CI success rate / flaky tests

### Section B: Product Delivery
- Active sprint burndown
- Velocity trend (last 6 sprints)
- Blocked tickets with owners
- Epic progress (% complete, at-risk epics)
- Bug backlog trend (open vs closed)
- Release calendar / upcoming releases

### Section C: Operational Excellence
- **Uptime / SLO status** by critical service
- Open incidents (P0/P1/P2) with owner and age
- Error rate and p95 latency graphs
- On-call load distribution (burnout warning)
- Post-incident action items pending

### Section D: Security & Compliance
- Open CVEs by severity
- Critical vulnerabilities > SLA
- Secrets scanning findings
- Compliance control pass/fail
- Pending audit evidence

### Section E: Financial Efficiency
- Cloud spend MTD vs budget
- Cost per transaction / per active user
- Top cost drivers
- Reserved capacity / savings opportunities

### Section F: Team & Talent
- Team capacity this week (PTO/on-call/training)
- Hiring pipeline (open roles, time-in-stage)
- Team morale pulse (optional Slack sentiment or survey)
- Key dates (start dates, performance cycles)

---

## 3. Recommended Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | **Next.js 14+ (App Router) + TypeScript + Tailwind** | Fast SSR, great chart libraries, easy deployment. |
| UI components | **shadcn/ui + Tremor** or **Recharts** | Built-in dashboard components and charts. |
| Backend/API | **FastAPI (Python)** or **Next.js API routes** | Easy MCP integration, async data pulls. |
| Data store | **PostgreSQL** for metrics/events + **Redis** for caching | Reliable, time-series friendly with hypertable option (TimescaleDB). |
| Background jobs | **Celery + Redis** or **Temporal** | Schedule periodic syncs from each MCP source. |
| MCP framework | **Python MCP SDK** or **TypeScript MCP SDK** | Native integration with Codex/Claude Desktop. |
| Auth | **NextAuth.js / Auth.js** with GitHub/Jira OAuth | Secure, token-based, role-aware. |
| Deployment | **Vercel** frontend + **Render/Railway/Fly.io** backend + **Neon/Supabase** Postgres | Low-ops, good free tiers. |
| Containerization | **Docker + docker-compose** | Local dev parity. |

---

## 4. Data Model (high-level)

- `sources` — integrations and credentials
- `metrics` — time-series numeric metrics (DORA, costs, uptime)
- `events` — incidents, releases, alerts, vulnerabilities
- `entities` — repos, services, squads, epics
- `dashboards` / `widgets` — user-defined layouts

Use a normalized event stream approach where each MCP connector writes to a common schema, and the UI reads from materialized views.

---

## 5. Implementation Roadmap

### Milestone 0: Foundation (Week 1)
- Initialize repo and set git author to `vineetdaniel@gmail.com`.
- Set up Docker, Next.js, FastAPI, Postgres, Redis.
- Configure linting, formatting, GitHub Actions CI.
- Define common MCP connector interface.

### Milestone 1: GitHub + Jira MCP (Weeks 2–3)
- Build GitHub connector: PRs, commits, security alerts.
- Build Jira connector: sprints, epics, bugs, blocked tickets.
- Expose via MCP server and REST API.
- Store normalized data in Postgres.

### Milestone 2: Core Dashboard UI (Weeks 3–4)
- Build layout framework and authentication.
- Implement Engineering Health and Product Delivery sections.
- Add data refresh, caching, and error states.

### Milestone 3: Operations & Security (Weeks 5–6)
- Add observability/PagerDuty connectors.
- Add security widget (CVEs, secrets scanning).
- Add incident timeline.

### Milestone 4: Financial & People (Week 7)
- Add cloud billing connector.
- Add team capacity and hiring widget.

### Milestone 5: Polish & Deploy (Week 8)
- Add alerting thresholds and email/Slack notifications.
- Deploy to staging, then production.
- Write runbook and onboarding docs.

---

## 6. Open Questions for You

Before starting implementation, a few quick decisions will shape the first milestone:

1. **Primary project tracking**: Are you on **Jira Cloud**, **Jira Data Center**, or considering Linear/Shortcut?  
2. **Observability stack**: Do you currently use **Datadog, New Relic, Grafana Cloud, or something else** for uptime/metrics?  
3. **Hosting preference**: Should we optimize for **fastest local dev + free-tier deploy** (Vercel + Railway) or do you have a preferred cloud (AWS/GCP/Azure) and Kubernetes setup?  

Answer any/all and I’ll convert this plan into the first set of executable tasks and code.
