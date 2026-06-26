from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Any, Dict

import asyncio
import csv
import io
import json

from fastapi import FastAPI, Depends, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import JSONB

from backend.api import schemas
from backend.api.reports import generate_newsletter_pdf
from backend.config import settings
from backend.config_store import get_connector_config, list_connector_configs, mask_secrets, set_connector_config
from backend.db.models import init_db, get_db, Metric, Event, ConnectorConfig
from backend.db.seed import seed_if_empty
from backend.mcp.integrations import CONNECTORS


def _connector_with_config(name: str, db):
    config = get_connector_config(name, db)
    return CONNECTORS[name](config=config)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = next(get_db())
    try:
        seed_if_empty(db)
    finally:
        db.close()
    yield


app = FastAPI(title="CTO Dash API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.APP_ENV == "development" else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def parse_window(date_range: str | None) -> datetime | None:
    if not date_range:
        return None
    now = datetime.utcnow()
    mapping = {
        "24h": now - timedelta(hours=24),
        "7d": now - timedelta(days=7),
        "30d": now - timedelta(days=30),
        "90d": now - timedelta(days=90),
    }
    return mapping.get(date_range)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/live")
async def health_live(db: Session = Depends(get_db)):
    """Real-time health snapshot: DB latency, connector status, and active incidents."""
    import time

    start = time.time()
    try:
        db.execute(text("SELECT 1"))
        db_latency_ms = round((time.time() - start) * 1000, 1)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}")

    connector_status = {}
    for name, cls in CONNECTORS.items():
        try:
            conn = _connector_with_config(name, db)
            connector_status[name] = await conn.health_check()
        except Exception as exc:
            connector_status[name] = {"ok": False, "error": str(exc)}

    active_incidents = (
        db.query(Event)
        .filter(Event.event_type == "incident", Event.status != "resolved")
        .count()
    )

    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "db_latency_ms": db_latency_ms,
        "connectors": connector_status,
        "active_incidents": active_incidents,
    }


@app.post("/seed")
async def seed(force: bool = False, db: Session = Depends(get_db)):
    result = seed_if_empty(db, force=force)
    return result


@app.get("/settings")
async def app_settings(db: Session = Depends(get_db)):
    return {
        "observability_provider": settings.OBSERVABILITY_PROVIDER,
        "jira_project_keys": settings.JIRA_PROJECT_KEYS.split(",") if settings.JIRA_PROJECT_KEYS else [],
        "github_org": settings.GITHUB_ORG,
        "connectors": list_connector_configs(db),
    }


@app.get("/connectors/health", response_model=schemas.ConnectorHealthResponse)
async def connectors_health(db: Session = Depends(get_db)):
    async def check_one(name: str):
        try:
            conn = _connector_with_config(name, db)
            return name, await asyncio.wait_for(conn.health_check(), timeout=8.0)
        except asyncio.TimeoutError:
            return name, {"ok": False, "error": "timed out"}
        except Exception as exc:
            return name, {"ok": False, "error": str(exc)}

    pairs = await asyncio.gather(*[check_one(name) for name in CONNECTORS])
    return {"connectors": dict(pairs)}


@app.get("/settings/connectors", response_model=list[schemas.ConnectorConfigOut])
async def list_connectors(db: Session = Depends(get_db)):
    return list_connector_configs(db)


_GUIDES: Dict[str, schemas.ConnectorGuideOut] = {
    "aws_cost": schemas.ConnectorGuideOut(
        name="aws_cost",
        label="AWS Cost",
        description="Connect AWS Cost Explorer to pull month-to-date cloud spend, budget usage, top cost drivers, and savings opportunities.",
        docs_url="https://aws.amazon.com/aws-cost-management/aws-cost-explorer/",
        fields=[
            schemas.ConnectorGuideField(
                key="AWS_ACCESS_KEY_ID",
                label="AWS access key ID",
                type="text",
                required=True,
                placeholder="AKIA...",
                help="Programmatic access key for an IAM user with ce:* and budgets:* permissions.",
            ),
            schemas.ConnectorGuideField(
                key="AWS_SECRET_ACCESS_KEY",
                label="AWS secret access key",
                type="password",
                required=True,
                placeholder="wJalrXU...",
                help="Secret for the IAM access key. Stored server-side and masked in the UI.",
                secret=True,
            ),
            schemas.ConnectorGuideField(
                key="AWS_SESSION_TOKEN",
                label="AWS session token (optional)",
                type="password",
                required=False,
                placeholder="IQoJb3...",
                help="Required only when using temporary credentials such as SSO or assumed roles.",
                secret=True,
            ),
            schemas.ConnectorGuideField(
                key="AWS_REGION",
                label="AWS region",
                type="text",
                required=True,
                placeholder="us-east-1",
                help="Region used for Cost Explorer API calls. Most cost queries work from us-east-1.",
            ),
            schemas.ConnectorGuideField(
                key="AWS_SERVICES",
                label="Services to monitor",
                type="text",
                required=False,
                placeholder="EC2,S3,RDS,Lambda,Data Transfer",
                help="Comma-separated service names to highlight in cost-driver widgets.",
            ),
            schemas.ConnectorGuideField(
                key="AWS_MONTHLY_BUDGET",
                label="Monthly budget override",
                type="number",
                required=False,
                placeholder="50000",
                help="Leave empty to auto-estimate from last month spend + 10%. Enter a dollar amount to override the budget used in charts.",
            ),
            schemas.ConnectorGuideField(
                key="AWS_COST_DELTA_THRESHOLD_PCT",
                label="Cost increase alert threshold (%)",
                type="number",
                required=False,
                placeholder="25",
                help="Month-over-month percentage increase that triggers a cost driver event. Default is 25%.",
            ),
            schemas.ConnectorGuideField(
                key="AWS_COST_CRITICAL_RISK_THRESHOLD_PCT",
                label="Critical cost risk threshold (%)",
                type="number",
                required=False,
                placeholder="50",
                help="Month-over-month percentage increase that marks a cost driver event as critical severity. Default is 50%.",
            ),
            schemas.ConnectorGuideField(
                key="AWS_COST_TOP_DRIVERS_COUNT",
                label="Top cost drivers to display",
                type="number",
                required=False,
                placeholder="5",
                help="Number of top services to emit as cost drivers. Default is 5.",
            ),
        ],
        steps=[
            schemas.ConnectorGuideStep(
                label="Create an IAM policy",
                description="Create a policy with ce:GetCostAndUsage, ce:GetCostForecast, budgets:ViewBudget, and pricing:GetProducts for cost data retrieval.",
            ),
            schemas.ConnectorGuideStep(
                label="Create an access key",
                description="In IAM → Users → Security credentials, create an access key for a user that has the cost policy attached. For SSO users, use a session token.",
            ),
            schemas.ConnectorGuideStep(
                label="Copy credentials",
                description="Paste the access key ID and secret access key into the fields. Session token is only needed for temporary credentials.",
            ),
            schemas.ConnectorGuideStep(
                label="Choose region, services, and thresholds",
                description="Set AWS_REGION, optional AWS_SERVICES, and tuning knobs: monthly budget override, delta alert threshold, critical risk threshold, and number of top cost drivers to surface.",
            ),
        ],
    ),
    "github": schemas.ConnectorGuideOut(
        name="github",
        label="GitHub",
        description="Connect to your GitHub organization to pull open PRs, repositories, and Dependabot security alerts.",
        docs_url="https://github.com/settings/tokens",
        fields=[
            schemas.ConnectorGuideField(
                key="GITHUB_TOKEN",
                label="GitHub personal access token",
                type="password",
                required=True,
                placeholder="ghp_...",
                help="Fine-grained token with repo and read:org permissions.",
                secret=True,
            ),
            schemas.ConnectorGuideField(
                key="GITHUB_ORG",
                label="GitHub organization slug",
                type="text",
                required=True,
                placeholder="acme-corp",
                help="The org login used in github.com/<org> URLs.",
            ),
        ],
        steps=[
            schemas.ConnectorGuideStep(
                label="Open GitHub token settings",
                description="Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) or Fine-grained tokens.",
            ),
            schemas.ConnectorGuideStep(
                label="Create a token",
                description="For classic tokens, select repo and read:org. For fine-grained tokens, choose the organization as the resource owner and grant Repository permissions (read) + Organization permissions (read:organization).",
            ),
            schemas.ConnectorGuideStep(
                label="Copy the token",
                description="Paste the token into the GITHUB_TOKEN field. The token is stored encrypted server-side and masked in the UI.",
            ),
            schemas.ConnectorGuideStep(
                label="Enter the org slug",
                description="Set GITHUB_ORG to the organization name shown in github.com/<org> URLs (for example, acme-corp).",
            ),
        ],
    ),
    "jira": schemas.ConnectorGuideOut(
        name="jira",
        label="Jira",
        description="Connect to Jira Cloud or Jira Server to track open issues, bugs, and blocked tickets.",
        docs_url="https://id.atlassian.com/manage-profile/security/api-tokens",
        fields=[
            schemas.ConnectorGuideField(
                key="JIRA_SERVER",
                label="Jira server URL",
                type="text",
                required=True,
                placeholder="https://acme.atlassian.net",
                help="Jira Cloud or Server base URL, without a trailing slash.",
            ),
            schemas.ConnectorGuideField(
                key="JIRA_USERNAME",
                label="Jira username (email)",
                type="text",
                required=True,
                placeholder="you@company.com",
                help="The email address you use to log in to Jira Cloud.",
            ),
            schemas.ConnectorGuideField(
                key="JIRA_API_TOKEN",
                label="Jira API token",
                type="password",
                required=True,
                placeholder="ATATT3x...",
                help="Created at id.atlassian.com/manage-profile/security/api-tokens.",
                secret=True,
            ),
            schemas.ConnectorGuideField(
                key="JIRA_PROJECT_KEYS",
                label="Project keys",
                type="text",
                required=True,
                placeholder="PAY,PLAT,SEC",
                help="Comma-separated Jira project keys to monitor.",
            ),
        ],
        steps=[
            schemas.ConnectorGuideStep(
                label="Create an API token",
                description="Visit id.atlassian.com/manage-profile/security/api-tokens, click Create API token, and give it a label like 'CTO Dash'.",
            ),
            schemas.ConnectorGuideStep(
                label="Copy the token",
                description="Copy the token and paste it into the JIRA_API_TOKEN field. The token is stored server-side and masked in the UI.",
            ),
            schemas.ConnectorGuideStep(
                label="Enter server and user",
                description="Set JIRA_SERVER to your Jira base URL (for example, https://acme.atlassian.net) and JIRA_USERNAME to the email you log in with.",
            ),
            schemas.ConnectorGuideStep(
                label="Add project keys",
                description="List the Jira project keys you want to monitor, comma-separated, such as PAY,PLAT,SEC.",
            ),
        ],
    ),
    "jenkins": schemas.ConnectorGuideOut(
        name="jenkins",
        label="Jenkins",
        description="Connect Jenkins to pull CI/CD build status, pass rate, duration, and recent failures.",
        docs_url="https://www.jenkins.io/doc/book/using/remote-access-api/",
        fields=[
            schemas.ConnectorGuideField(
                key="JENKINS_URL",
                label="Jenkins URL",
                type="text",
                required=True,
                placeholder="https://jenkins.company.com",
                help="Jenkins base URL, without a trailing slash. Include the full path if Jenkins is behind a reverse proxy.",
            ),
            schemas.ConnectorGuideField(
                key="JENKINS_USERNAME",
                label="Jenkins username",
                type="text",
                required=False,
                placeholder="cto-dash",
                help="User the API key belongs to. Optional if the key is user-independent.",
            ),
            schemas.ConnectorGuideField(
                key="JENKINS_API_KEY",
                label="Jenkins API key",
                type="password",
                required=True,
                placeholder="11e8...",
                help="Create at Jenkins → User → Configure → API Token.",
                secret=True,
            ),
        ],
        steps=[
            schemas.ConnectorGuideStep(
                label="Open Jenkins user settings",
                description="Click your username in the top-right, then choose Configure.",
            ),
            schemas.ConnectorGuideStep(
                label="Create an API token",
                description="In the API Token section, click Add new Token, give it a name like 'CTO Dash', and Generate.",
            ),
            schemas.ConnectorGuideStep(
                label="Copy the token",
                description="Paste the token into the JENKINS_API_KEY field. It is stored server-side and masked in the UI.",
            ),
            schemas.ConnectorGuideStep(
                label="Enter Jenkins URL",
                description="Set JENKINS_URL to the root URL you use to open Jenkins, for example https://jenkins.company.com.",
            ),
        ],
    ),
    "observability": schemas.ConnectorGuideOut(
        name="observability",
        label="Observability",
        description="Connect Datadog or New Relic to pull uptime, latency, error rate, incident, and SLO-breach data.",
        docs_url=None,
        fields=[
            schemas.ConnectorGuideField(
                key="OBSERVABILITY_PROVIDER",
                label="Provider",
                type="select",
                required=True,
                placeholder="datadog",
                help="Choose datadog or newrelic. Only the matching provider's fields are required.",
            ),
            schemas.ConnectorGuideField(
                key="DD_API_KEY",
                label="Datadog API key",
                type="password",
                required=False,
                placeholder="1234...",
                help="From Datadog → Organization Settings → API Keys.",
                secret=True,
            ),
            schemas.ConnectorGuideField(
                key="DD_APP_KEY",
                label="Datadog application key",
                type="password",
                required=False,
                placeholder="1234...",
                help="From Datadog → Organization Settings → Application Keys. Must have 'metrics_read' scope.",
                secret=True,
            ),
            schemas.ConnectorGuideField(
                key="DD_SITE",
                label="Datadog site",
                type="text",
                required=False,
                placeholder="datadoghq.com",
                help="Your Datadog site host, e.g. datadoghq.com, datadoghq.eu, us3.datadoghq.com.",
            ),
            schemas.ConnectorGuideField(
                key="DD_SERVICES",
                label="Datadog services",
                type="text",
                required=False,
                placeholder="api-gateway,payments-core,ledger,auth-service,webhook-router",
                help="Comma-separated service tags to monitor. Must match the service tag in Datadog APM.",
            ),
            schemas.ConnectorGuideField(
                key="DD_ENVIRONMENT",
                label="Datadog environment tag",
                type="text",
                required=False,
                placeholder="prod",
                help="The env tag used in your Datadog metrics, e.g. prod.",
            ),
            schemas.ConnectorGuideField(
                key="DD_UPTIME_QUERY",
                label="Datadog uptime query",
                type="textarea",
                required=False,
                placeholder="100 - ( avg:trace.http.request.errors{service:%s,env:%s}.as_count() / avg:trace.http.request.hits{service:%s,env:%s}.as_count() * 100 )",
                help="Use %s for service and environment placeholders. Result must be a percentage.",
            ),
            schemas.ConnectorGuideField(
                key="DD_LATENCY_QUERY",
                label="Datadog p95 latency query",
                type="textarea",
                required=False,
                placeholder="p95:trace.http.request.duration{service:%s,env:%s,resource_name:*}",
                help="Use %s for service and environment placeholders. Result is milliseconds.",
            ),
            schemas.ConnectorGuideField(
                key="DD_P99_LATENCY_QUERY",
                label="Datadog p99 latency query",
                type="textarea",
                required=False,
                placeholder="p99:trace.http.request.duration{service:%s,env:%s,resource_name:*}",
                help="Use %s for service and environment placeholders. Result is milliseconds.",
            ),
            schemas.ConnectorGuideField(
                key="DD_ERROR_RATE_QUERY",
                label="Datadog error-rate query",
                type="textarea",
                required=False,
                placeholder="( avg:trace.http.request.errors{service:%s,env:%s}.as_count() / avg:trace.http.request.hits{service:%s,env:%s}.as_count() ) * 100",
                help="Use %s for service and environment placeholders. Result must be a percentage.",
            ),
            schemas.ConnectorGuideField(
                key="DD_TRANSACTION_VOLUME_QUERY",
                label="Datadog transaction-volume query",
                type="textarea",
                required=False,
                placeholder="sum:trace.http.request.hits{service:%s,env:%s}.as_count()",
                help="Use %s for service and environment placeholders. Result must be a request count over 24 hours. This feeds the Cost Per Transaction widget.",
            ),
            schemas.ConnectorGuideField(
                key="NR_API_KEY",
                label="New Relic API key",
                type="password",
                required=False,
                placeholder="NRAK-...",
                help="User API key from New Relic → API keys.",
                secret=True,
            ),
            schemas.ConnectorGuideField(
                key="NR_ACCOUNT_ID",
                label="New Relic account ID",
                type="text",
                required=False,
                placeholder="1234567",
                help="Found in the account dropdown in the New Relic UI.",
            ),
            schemas.ConnectorGuideField(
                key="NR_SERVICES",
                label="New Relic app names",
                type="text",
                required=False,
                placeholder="api-gateway,payments-core,ledger,auth-service,webhook-router",
                help="Comma-separated APM app names to monitor.",
            ),
            schemas.ConnectorGuideField(
                key="NR_ENVIRONMENT",
                label="New Relic environment",
                type="text",
                required=False,
                placeholder="prod",
                help="Environment attribute used in NRQL WHERE clauses.",
            ),
            schemas.ConnectorGuideField(
                key="NR_TRANSACTION_VOLUME_QUERY",
                label="New Relic transaction-volume query",
                type="textarea",
                required=False,
                placeholder="SELECT count(*) FROM Transaction WHERE appName = '%s' AND environment = '%s' SINCE 24 hours ago",
                help="Use %s for appName and environment placeholders. Result must be a request count over 24 hours. This feeds the Cost Per Transaction widget.",
            ),
        ],
        steps=[
            schemas.ConnectorGuideStep(
                label="Pick a provider",
                description="Set OBSERVABILITY_PROVIDER to datadog or newrelic. Only the matching provider's fields are required.",
            ),
            schemas.ConnectorGuideStep(
                label="Datadog credentials",
                description="In Datadog, go to Organization Settings → API Keys to create an API key, and Organization Settings → Application Keys to create an application key. Set DD_SITE to your region host.",
            ),
            schemas.ConnectorGuideStep(
                label="Datadog service tags",
                description="Set DD_SERVICES to the service tag values used in Datadog APM (for example, api-gateway,payments-core). Set DD_ENVIRONMENT to the env tag you filter by, usually prod.",
            ),
            schemas.ConnectorGuideStep(
                label="Customize metric queries (optional)",
                description="The default queries assume Datadog APM trace metrics. If your service names or tags differ, override DD_UPTIME_QUERY, DD_LATENCY_QUERY, DD_P99_LATENCY_QUERY, DD_ERROR_RATE_QUERY, and DD_TRANSACTION_VOLUME_QUERY. Use %s where the service and environment should be inserted. For New Relic, override NR_TRANSACTION_VOLUME_QUERY using %s for appName and environment.",
            ),
            schemas.ConnectorGuideStep(
                label="New Relic credentials",
                description="In New Relic, go to API keys and create a User key. Find your account ID in the account dropdown and set NR_ACCOUNT_ID.",
            ),
            schemas.ConnectorGuideStep(
                label="New Relic app names",
                description="Set NR_SERVICES to the APM application names you want to monitor, comma-separated.",
            ),
        ],
    ),
}


@app.get("/settings/connectors/{name}/guide", response_model=schemas.ConnectorGuideOut)
async def connector_guide(name: str):
    if name not in _GUIDES:
        raise HTTPException(status_code=404, detail=f"Unknown connector: {name}")
    return _GUIDES[name]


@app.post("/settings/connectors/{name}", response_model=schemas.ConnectorSaveOut)
async def save_connector(name: str, payload: Dict[str, Any], db: Session = Depends(get_db)):
    if name not in CONNECTORS:
        raise HTTPException(status_code=404, detail=f"Unknown connector: {name}")

    # Preserve secrets already stored if the frontend sent a mask value.
    row = db.query(ConnectorConfig).filter(ConnectorConfig.name == name).first()
    stored = row.config if row else {}
    cleaned: Dict[str, Any] = {}
    for key, value in payload.items():
        if isinstance(value, str) and value.startswith("•"):
            cleaned[key] = stored.get(key)
        else:
            cleaned[key] = value

    set_connector_config(name, cleaned, db)
    conn = _connector_with_config(name, db)
    health = await conn.health_check()

    summary = list_connector_configs(db)
    item = next((c for c in summary if c["name"] == name), None)
    return {
        "name": name,
        "configured": item["configured"] if item else False,
        "config": item["config"] if item else mask_secrets(cleaned),
        "health": health,
    }


def _coerce_dt(value: Any, default: datetime | None = None) -> datetime:
    """Normalize a connector-supplied timestamp (ISO string or datetime) to a
    naive UTC datetime so it can be used as part of an upsert natural key."""
    if isinstance(value, datetime):
        dt_val = value
    elif isinstance(value, str) and value.strip():
        raw = value.strip().replace("Z", "+00:00")
        try:
            dt_val = datetime.fromisoformat(raw)
        except ValueError:
            return default or datetime.utcnow()
    else:
        return default or datetime.utcnow()
    # Drop tzinfo to match the naive DateTime column.
    if dt_val.tzinfo is not None:
        dt_val = dt_val.replace(tzinfo=None)
    return dt_val


def _upsert_metrics(db: Session, metrics: list[dict[str, Any]]) -> dict[str, int]:
    """Upsert metrics by natural key (source, metric_type, entity, timestamp).

    New keys are inserted; existing rows are updated only when a value actually
    changed. Nothing is ever deleted, so historical time-series are preserved.
    """
    inserted = updated = unchanged = 0
    for m in metrics:
        ts = _coerce_dt(m.get("timestamp"))
        existing = (
            db.query(Metric)
            .filter(
                Metric.source == m["source"],
                Metric.metric_type == m["metric_type"],
                Metric.entity == m.get("entity"),
                Metric.timestamp == ts,
            )
            .first()
        )
        if existing is None:
            db.add(Metric(
                source=m["source"],
                metric_type=m["metric_type"],
                entity=m.get("entity"),
                value=m.get("value"),
                value_text=m.get("value_text"),
                meta=m.get("meta") or {},
                timestamp=ts,
                is_seed=False,
            ))
            inserted += 1
            continue

        new_value = m.get("value")
        new_text = m.get("value_text")
        new_meta = m.get("meta") or {}
        if (
            existing.value == new_value
            and existing.value_text == new_text
            and existing.meta == new_meta
            and existing.is_seed is False
        ):
            unchanged += 1
            continue

        existing.value = new_value
        existing.value_text = new_text
        existing.meta = new_meta
        existing.is_seed = False
        updated += 1
    return {"inserted": inserted, "updated": updated, "unchanged": unchanged}


def _upsert_events(db: Session, events: list[dict[str, Any]]) -> dict[str, int]:
    """Upsert events by natural key (source, event_type, entity, title,
    happened_at). Insert new, update changed (status/severity/meta), never delete."""
    inserted = updated = unchanged = 0
    for e in events:
        ts = _coerce_dt(e.get("happened_at"))
        existing = (
            db.query(Event)
            .filter(
                Event.source == e["source"],
                Event.event_type == e["event_type"],
                Event.entity == e.get("entity"),
                Event.title == e["title"],
                Event.happened_at == ts,
            )
            .first()
        )
        if existing is None:
            db.add(Event(
                source=e["source"],
                event_type=e["event_type"],
                entity=e.get("entity"),
                title=e["title"],
                severity=e.get("severity"),
                status=e.get("status"),
                meta=e.get("meta") or {},
                happened_at=ts,
                is_seed=False,
            ))
            inserted += 1
            continue

        new_meta = e.get("meta") or {}
        if (
            existing.severity == e.get("severity")
            and existing.status == e.get("status")
            and existing.meta == new_meta
            and existing.is_seed is False
        ):
            unchanged += 1
            continue

        existing.severity = e.get("severity")
        existing.status = e.get("status")
        existing.meta = new_meta
        existing.is_seed = False
        updated += 1
    return {"inserted": inserted, "updated": updated, "unchanged": unchanged}


@app.post("/sync/{source}")
async def sync_source(source: str, db: Session = Depends(get_db)):
    if source not in CONNECTORS:
        raise HTTPException(status_code=404, detail=f"Unknown source: {source}")

    conn = _connector_with_config(source, db)
    health = await conn.health_check()
    if not health["ok"]:
        raise HTTPException(status_code=400, detail=health)

    metrics = await conn.fetch_metrics()
    events = await conn.fetch_events()

    # Derive a real cost-per-transaction metric when AWS spend is synced and
    # observability transaction-volume metrics already exist in the database.
    if source == "aws_cost":
        cost_per_txn = _compute_cost_per_transaction(metrics, db)
        if cost_per_txn:
            metrics.append(cost_per_txn)

    # Clear only disposable SEED placeholder rows for this source on a real
    # sync (seed uses historical timestamps that real syncs won't reproduce, so
    # without this they'd coexist and pollute charts). Real/synced history is
    # never deleted. Skip the purge if the connector returned nothing, so a
    # transient empty fetch doesn't wipe the seed fallback.
    if metrics:
        db.query(Metric).filter(
            Metric.source == source, Metric.is_seed.is_(True)
        ).delete(synchronize_session=False)
    if events:
        db.query(Event).filter(
            Event.source == source, Event.is_seed.is_(True)
        ).delete(synchronize_session=False)

    # Upsert by natural key: insert new rows, update only changed ones, never
    # delete real data. Historical time-series (trends, monthly spend, daily
    # evidence) are preserved across syncs.
    metric_stats = _upsert_metrics(db, metrics)
    event_stats = _upsert_events(db, events)

    db.commit()

    from collections import Counter
    metric_breakdown = dict(Counter(m.get("metric_type", "unknown") for m in metrics))
    event_breakdown = dict(Counter(e.get("event_type", "unknown") for e in events))

    return {
        "source": source,
        "metrics": len(metrics),
        "events": len(events),
        "metrics_upsert": metric_stats,
        "events_upsert": event_stats,
        "metric_breakdown": metric_breakdown,
        "event_breakdown": event_breakdown,
    }


def _compute_cost_per_transaction(metrics: list[dict[str, Any]], db: Session) -> dict[str, Any] | None:
    """Compute cloud_spend_mtd / total transaction_volume for the trailing 24 hours.

    Transaction volume is pulled from the most recent observability sync
    (Datadog or New Relic). Without it the widget falls back to seed/placeholder data.
    """
    spend_metric = next((m for m in metrics if m.get("metric_type") == "cloud_spend_mtd"), None)
    if not spend_metric:
        return None
    spend_value = float(spend_metric.get("value") or 0)
    if spend_value <= 0:
        return None

    since = datetime.utcnow() - timedelta(hours=24)
    tx_rows = db.query(Metric).filter(
        Metric.metric_type == "transaction_volume",
        Metric.timestamp >= since,
    ).all()
    total_volume = sum(float(m.value or 0) for m in tx_rows)
    if total_volume <= 0:
        return None

    return {
        "source": "aws_cost",
        "metric_type": "cost_per_transaction",
        "entity": "aws",
        "value": round(spend_value / total_volume, 6),
        "meta": {
            "mtd_spend": round(spend_value, 2),
            "transaction_volume": round(total_volume, 2),
            "basis": "cloud_spend_mtd / observability_transaction_volume",
        },
        "timestamp": datetime.utcnow().isoformat(),
    }


def _normalize_header(name: str) -> str:
    return name.strip().lower().replace(" ", "_").replace("-", "_")


_FRAMEWORK_ALIASES = {
    "pci_dss": "pci_dss",
    "pci-dss": "pci_dss",
    "pci": "pci_dss",
    "pci dss": "pci_dss",
    "iso_27001": "iso_27001",
    "iso-27001": "iso_27001",
    "iso": "iso_27001",
    "iso 27001": "iso_27001",
    "iso27001": "iso_27001",
}


def _normalize_framework(value: str | None) -> str | None:
    if not value:
        return None
    return _FRAMEWORK_ALIASES.get(value.strip().lower())


def _normalize_status(value: str | None) -> str | None:
    if not value:
        return None
    return value.strip().lower()


def _parse_date(value: str | None) -> str | None:
    if not value:
        return None
    value = value.strip()
    try:
        dt = datetime.fromisoformat(value)
        return dt.date().isoformat()
    except ValueError:
        pass
    for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _control_value(status: str) -> float | None:
    return {
        "passed": 1.0,
        "compliant": 1.0,
        "partial": 0.5,
        "in_progress": 0.5,
        "pending": None,
        "not_applicable": None,
        "failed": 0.0,
        "non_compliant": 0.0,
    }.get(status)


def _control_severity(status: str, provided: str | None) -> str:
    if provided:
        return provided.strip().lower()
    if status in ("failed", "non_compliant"):
        return "high"
    if status in ("partial", "pending"):
        return "medium"
    return "low"


def _read_csv(file_bytes: bytes) -> list[dict]:
    text_io = io.StringIO(file_bytes.decode("utf-8-sig"))
    reader = csv.DictReader(text_io)
    return [{_normalize_header(k): v.strip() for k, v in row.items()} for row in reader]


def _read_xlsx(file_bytes: bytes) -> list[dict]:
    try:
        import openpyxl
    except ImportError as exc:
        raise HTTPException(status_code=400, detail="Excel support requires openpyxl; install backend requirements") from exc
    workbook = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    sheet = workbook.active
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [_normalize_header(str(h)) for h in rows[0]]
    return [dict(zip(headers, row)) for row in rows[1:]]


def _parse_compliance_rows(rows: list[dict]) -> tuple[list[dict], list[dict], list[str]]:
    metrics: list[dict] = []
    events: list[dict] = []
    errors: list[str] = []
    now = datetime.utcnow()

    for idx, row in enumerate(rows, start=2):
        framework = _normalize_framework(row.get("framework"))
        control_id = (row.get("control_id") or "").strip()
        title = (row.get("title") or "").strip()
        status = _normalize_status(row.get("status"))
        owner = (row.get("owner") or "").strip() or None
        requirement = (row.get("requirement") or "").strip() or None
        evidence_url = (row.get("evidence_url") or "").strip() or None
        severity = _control_severity(status or "", row.get("severity"))
        reviewed_at = _parse_date(row.get("reviewed_at"))
        next_review_at = _parse_date(row.get("next_review_at"))
        notes = (row.get("notes") or "").strip() or None

        if not framework:
            errors.append(f"Row {idx}: missing or unrecognized framework")
            continue
        if not control_id:
            errors.append(f"Row {idx}: missing control_id")
            continue
        if not title:
            errors.append(f"Row {idx}: missing title")
            continue
        if not status:
            errors.append(f"Row {idx}: missing status")
            continue

        meta = {
            "framework": framework,
            "control_id": control_id,
            "title": title,
            "status": status,
        }
        if requirement:
            meta["requirement"] = requirement
        if owner:
            meta["owner"] = owner
        if evidence_url:
            meta["evidence_url"] = evidence_url
        if severity:
            meta["severity"] = severity
        if reviewed_at:
            meta["reviewed_at"] = reviewed_at
        if next_review_at:
            meta["next_review_at"] = next_review_at
        if notes:
            meta["notes"] = notes

        metrics.append(
            {
                "source": "compliance_manual",
                "metric_type": "compliance_control_status",
                "entity": control_id,
                "value": _control_value(status),
                "meta": meta,
                "timestamp": now,
            }
        )

        if status in ("failed", "non_compliant"):
            events.append(
                {
                    "source": "compliance_manual",
                    "event_type": "compliance_finding",
                    "entity": control_id,
                    "title": f"{control_id}: {title}",
                    "severity": severity,
                    "status": "open",
                    "meta": meta,
                    "happened_at": now,
                }
            )
        elif status in ("partial", "pending"):
            events.append(
                {
                    "source": "compliance_manual",
                    "event_type": "compliance_review_needed",
                    "entity": control_id,
                    "title": f"{control_id}: {title}",
                    "severity": severity,
                    "status": "open",
                    "meta": meta,
                    "happened_at": now,
                }
            )

        if next_review_at:
            try:
                next_dt = datetime.fromisoformat(next_review_at)
                if (next_dt.date() - now.date()).days <= 30 and status not in ("failed", "non_compliant"):
                    events.append(
                        {
                            "source": "compliance_manual",
                            "event_type": "evidence_expiry",
                            "entity": control_id,
                            "title": f"{control_id} review due on {next_review_at}",
                            "severity": "low",
                            "status": "scheduled",
                            "meta": {**meta, "days_until_review": (next_dt.date() - now.date()).days},
                            "happened_at": now,
                        }
                    )
            except ValueError:
                pass

    return metrics, events, errors


@app.post("/compliance/upload", response_model=schemas.ComplianceUploadOut)
async def upload_compliance_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    allowed = {".csv", ".xlsx"}
    filename = (file.filename or "").lower()
    if not any(filename.endswith(suffix) for suffix in allowed):
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed: {', '.join(allowed)}")

    content = await file.read()
    try:
        if filename.endswith(".csv"):
            rows = _read_csv(content)
        else:
            rows = _read_xlsx(content)
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Could not decode CSV as UTF-8: {exc}") from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {exc}") from exc

    metrics, events, errors = _parse_compliance_rows(rows)

    # Replace previous manual compliance data so each upload is idempotent.
    db.query(Metric).filter(Metric.source == "compliance_manual").delete(synchronize_session=False)
    db.query(Event).filter(Event.source == "compliance_manual").delete(synchronize_session=False)

    for m in metrics:
        db.add(Metric(**{**m, "is_seed": False}))
    for e in events:
        db.add(Event(**{**e, "is_seed": False}))

    db.commit()

    return {
        "source": "compliance_manual",
        "metrics": len(metrics),
        "events": len(events),
        "errors": errors,
    }


@app.get("/compliance/template")
async def download_compliance_template():
    """Return the canonical compliance controls CSV template."""
    import os

    template_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "templates", "compliance_controls_template.csv")
    if not os.path.exists(template_path):
        raise HTTPException(status_code=404, detail="Template file not found")
    with open(template_path, "rb") as f:
        content = f.read()
    return StreamingResponse(
        io.BytesIO(content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=compliance_controls_template.csv"},
    )


@app.get("/metrics", response_model=list[schemas.MetricOut])
async def list_metrics(
    source: str | None = None,
    metric_type: str | None = None,
    dateRange: str | None = Query(None, description="24h, 7d, 30d, 90d"),
    squad: str | None = Query(None),
    environment: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Metric)
    if source:
        q = q.filter(Metric.source == source)
    if metric_type:
        q = q.filter(Metric.metric_type == metric_type)
    if dateRange:
        window = parse_window(dateRange)
        if window:
            q = q.filter(Metric.timestamp >= window)
    if squad and squad != "all":
        q = q.filter((Metric.entity.ilike(f"%{squad}%")) | (Metric.meta.cast(JSONB).op("@>")({"squad": squad})))
    if environment and environment != "all":
        q = q.filter(Metric.meta.cast(JSONB).op("@>")({"environment": environment}))
    return q.order_by(Metric.timestamp.desc()).all()


def _norm_name(name: str | None) -> str:
    """Normalize a developer name for fuzzy cross-source matching."""
    if not name:
        return ""
    return " ".join(str(name).strip().lower().split())


def _match_keys(name: str | None) -> list[str]:
    """Ordered candidate keys for fuzzy matching a name across sources: the full
    normalized name first, then the first token (first name). Lets "Avinash"
    (commit author) match "Avinash Kumar" (planning resource) without
    false-joining unrelated people on a shared surname. Order matters so an
    exact full-name match always wins over a first-name match."""
    norm = _norm_name(name)
    if not norm:
        return []
    keys = [norm]
    first = norm.split(" ", 1)[0]
    if len(first) >= 3 and first != norm:  # avoid matching on tiny tokens
        keys.append(first)
    return keys


@app.get("/productivity/developers", response_model=schemas.ProductivitySummary)
async def productivity_developers(
    dateRange: str | None = Query(None, description="24h, 7d, 30d, 90d"),
    sprint_id: int | None = Query(None),
    team: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Per-developer productivity rollup. Aggregation happens in SQL (scales as
    `metrics` grows); planning and connector signals are merged by fuzzy name.
    Connector identities with no planning resource land in `unmatched`."""
    window = parse_window(dateRange)

    # --- Planning side: resources + allocations + tasks (SQL aggregation) ---
    plan_params: dict[str, Any] = {}
    plan_filters = ["r.is_active = true"]
    if sprint_id is not None:
        plan_filters.append("a.sprint_id = :sprint_id")
        plan_params["sprint_id"] = sprint_id
    if team and team != "all":
        plan_filters.append("r.team = :team")
        plan_params["team"] = team
    plan_where = " AND ".join(plan_filters)

    plan_rows = db.execute(text(f"""
        SELECT r.id AS resource_id, r.name, r.team, r.role, r.github_handle, r.jira_account_id,
               COALESCE(SUM(a.story_points), 0)::float AS allocated_sp,
               COALESCE(SUM(a.effective_hours), 0)::float AS effective_hours,
               COUNT(t.id)::int AS total_tasks,
               COUNT(t.id) FILTER (WHERE t.status = 'done')::int AS done_tasks,
               COUNT(t.id) FILTER (WHERE t.category = 'product')::int AS cat_product,
               COUNT(t.id) FILTER (WHERE t.category = 'integration')::int AS cat_integration,
               COUNT(t.id) FILTER (WHERE t.category = 'other')::int AS cat_other
        FROM resources r
        LEFT JOIN sprint_allocations a ON a.resource_id = r.id
        LEFT JOIN allocation_tasks t ON t.allocation_id = a.id
        WHERE {plan_where}
        GROUP BY r.id, r.name, r.team, r.role, r.github_handle, r.jira_account_id
        ORDER BY r.name
    """), plan_params).mappings().all()

    # --- GitHub commits per author (SQL GROUP BY meta->>'author_name') ---
    commit_params: dict[str, Any] = {}
    commit_where = ["source = 'github'", "metric_type = 'commit'"]
    if window is not None:
        commit_where.append("timestamp >= :win")
        commit_params["win"] = window
    commit_rows = db.execute(text(f"""
        SELECT meta->>'author_name' AS dev,
               LOWER(TRIM(meta->>'author_login')) AS login,
               COUNT(*)::int AS commits,
               COALESCE(SUM((meta->>'additions')::int), 0)::int AS lines_added,
               COALESCE(SUM((meta->>'deletions')::int), 0)::int AS lines_deleted
        FROM metrics
        WHERE {' AND '.join(commit_where)} AND meta->>'author_name' IS NOT NULL
        GROUP BY meta->>'author_name', meta->>'author_login'
    """), commit_params).mappings().all()
    # Two lookup tables: by GitHub login (exact) and by normalized display name (fuzzy).
    commits_by_login: dict[str, dict] = {}
    commits_by_name: dict[str, dict] = {}
    for r in commit_rows:
        entry = {"commits": r["commits"], "lines_added": r["lines_added"], "lines_deleted": r["lines_deleted"]}
        if r["login"]:
            existing = commits_by_login.get(r["login"], {"commits": 0, "lines_added": 0, "lines_deleted": 0})
            commits_by_login[r["login"]] = {k: existing[k] + entry[k] for k in entry}
        name_key = _norm_name(r["dev"])
        existing = commits_by_name.get(name_key, {"commits": 0, "lines_added": 0, "lines_deleted": 0})
        commits_by_name[name_key] = {k: existing[k] + entry[k] for k in entry}

    # --- Jira points + open issues per assignee ---
    # sprint mode: filter sprint_points_per_developer by sprint_id;
    # date-range mode: filter both metric types by timestamp window.
    jira_params: dict[str, Any] = {}
    if sprint_id is not None:
        # In sprint mode: only sprint_points rows for this sprint + latest open/done snapshot
        sprint_done_filter = "AND (metric_type != 'sprint_points_per_developer' OR (meta->>'sprint_id')::int = :jira_sprint_id)"
        jira_params["jira_sprint_id"] = sprint_id
        jira_time_filter = ""
    elif window is not None:
        sprint_done_filter = ""
        jira_time_filter = "AND timestamp >= :jira_win"
        jira_params["jira_win"] = window
    else:
        sprint_done_filter = ""
        jira_time_filter = ""

    jira_rows = db.execute(text(f"""
        SELECT meta->>'assignee_login' AS account_id,
               MAX(meta->>'assignee_name') AS dev,
               COALESCE(SUM(CASE WHEN metric_type='sprint_points_per_developer'
                                 THEN (meta->>'completed_points')::float END), 0) AS sprint_done_pts,
               COALESCE(MAX(CASE WHEN metric_type='developer_open_story_points'
                                 THEN value END), 0) AS open_pts,
               COALESCE(SUM(CASE WHEN metric_type='developer_open_story_points'
                                 THEN (meta->>'issue_count')::int END), 0)::int AS open_issues,
               COALESCE(MAX(CASE WHEN metric_type='developer_open_story_points'
                                 THEN (meta->>'done_count')::int END), 0)::int AS done_issues,
               COALESCE(MAX(CASE WHEN metric_type='developer_open_story_points'
                                 THEN (meta->>'done_points')::float END), 0) AS done_pts
        FROM metrics
        WHERE source = 'jira'
          AND metric_type IN ('sprint_points_per_developer', 'developer_open_story_points')
          AND meta->>'assignee_login' IS NOT NULL
          {sprint_done_filter}
          {jira_time_filter}
        GROUP BY meta->>'assignee_login'
    """), jira_params).mappings().all()
    jira_by_account: dict[str, dict] = {
        r["account_id"]: {
            "done": float(r["sprint_done_pts"] or 0) + float(r["done_pts"] or 0),
            "open": float(r["open_pts"] or 0),
            "open_issues": int(r["open_issues"] or 0),
            "done_issues": int(r["done_issues"] or 0),
        }
        for r in jira_rows
    }
    jira_by_name: dict[str, dict] = {
        _norm_name(r["dev"]): jira_by_account[r["account_id"]]
        for r in jira_rows if r["dev"]
    }

    # --- Merge planning + connector signals ---
    # Commits: prefer exact github_handle match; fall back to fuzzy display-name match.
    # Jira: prefer exact jira_account_id match; fall back to fuzzy display-name match.
    def claim(table: dict[str, Any], consumed: set[str], name: str) -> Any:
        for key in _match_keys(name):
            if key in table and key not in consumed:
                consumed.add(key)
                return table[key]
        return None

    consumed_commit_login: set[str] = set()
    consumed_commit_name: set[str] = set()
    consumed_jira_account: set[str] = set()
    consumed_jira_name: set[str] = set()
    developers: list[schemas.DeveloperProductivity] = []

    for row in plan_rows:
        # --- commits ---
        handle = (row["github_handle"] or "").strip().lower()
        if handle and handle in commits_by_login and handle not in consumed_commit_login:
            commit_data = commits_by_login[handle]
            consumed_commit_login.add(handle)
            for r in commit_rows:
                if (r["login"] or "") == handle:
                    consumed_commit_name.add(_norm_name(r["dev"]))
        else:
            commit_data = claim(commits_by_name, consumed_commit_name, row["name"]) or {"commits": 0, "lines_added": 0, "lines_deleted": 0}

        # --- jira ---
        jira_id = (row["jira_account_id"] or "").strip()
        if jira_id and jira_id in jira_by_account and jira_id not in consumed_jira_account:
            jira = jira_by_account[jira_id]
            consumed_jira_account.add(jira_id)
            # mark name consumed so unmatched pass skips it
            for r in jira_rows:
                if r["account_id"] == jira_id and r["dev"]:
                    consumed_jira_name.add(_norm_name(r["dev"]))
        else:
            jira = claim(jira_by_name, consumed_jira_name, row["name"]) or {"done": 0.0, "open": 0.0, "open_issues": 0}

        total = row["total_tasks"]
        done = row["done_tasks"]
        eff = float(row["effective_hours"] or 0)
        alloc_sp = float(row["allocated_sp"] or 0)
        developers.append(schemas.DeveloperProductivity(
            resource_id=row["resource_id"],
            name=row["name"],
            team=row["team"],
            role=row["role"],
            allocated_story_points=alloc_sp,
            effective_hours=eff,
            total_tasks=total,
            done_tasks=done,
            completion_pct=round(done / total * 100, 1) if total else 0,
            sp_per_effective_hour=round(alloc_sp / eff, 3) if eff > 0 else None,
            category_mix={
                "product": row["cat_product"],
                "integration": row["cat_integration"],
                "other": row["cat_other"],
            },
            commits=commit_data["commits"],
            lines_added=commit_data.get("lines_added", 0),
            lines_deleted=commit_data.get("lines_deleted", 0),
            jira_done_points=jira["done"],
            jira_open_points=jira["open"],
            jira_open_issues=jira.get("open_issues", 0),
            jira_done_issues=jira.get("done_issues", 0),
            matched=True,
        ))

    # --- Unmatched connector identities (not claimed by any planning resource) ---
    unmatched: list[schemas.DeveloperProductivity] = []
    seen_unmatched_login: set[str] = set()
    for r in commit_rows:
        login = (r["login"] or "").strip().lower()
        if login and login in consumed_commit_login:
            continue
        key = _norm_name(r["dev"])
        if login and login in seen_unmatched_login:
            continue
        if login:
            seen_unmatched_login.add(login)
        if key and key not in consumed_commit_name:
            jira = jira_by_name.get(key, {"done": 0.0, "open": 0.0, "open_issues": 0, "done_issues": 0})
            consumed_jira_name.add(key)
            cd = commits_by_name.get(key) or commits_by_login.get(login, {"commits": r["commits"], "lines_added": 0, "lines_deleted": 0})
            unmatched.append(schemas.DeveloperProductivity(
                name=r["dev"], commits=cd["commits"],
                lines_added=cd.get("lines_added", 0), lines_deleted=cd.get("lines_deleted", 0),
                jira_done_points=jira["done"], jira_open_points=jira["open"],
                jira_open_issues=jira.get("open_issues", 0),
                jira_done_issues=jira.get("done_issues", 0),
                matched=False,
            ))
    for r in jira_rows:
        if r["account_id"] in consumed_jira_account:
            continue
        key = _norm_name(r["dev"])
        if key and key not in consumed_jira_name:
            consumed_jira_name.add(key)
            jira = jira_by_account.get(r["account_id"], {"done": 0.0, "open": 0.0, "open_issues": 0, "done_issues": 0})
            unmatched.append(schemas.DeveloperProductivity(
                name=r["dev"],
                jira_done_points=jira["done"],
                jira_open_points=jira["open"],
                jira_open_issues=jira.get("open_issues", 0),
                jira_done_issues=jira.get("done_issues", 0),
                matched=False,
            ))

    total_tasks = sum(d.total_tasks for d in developers)
    total_done = sum(d.done_tasks for d in developers)
    with_tasks = [d for d in developers if d.total_tasks > 0]
    avg_completion = round(sum(d.completion_pct for d in with_tasks) / len(with_tasks), 1) if with_tasks else 0

    return schemas.ProductivitySummary(
        developers=developers,
        unmatched=unmatched,
        total_commits=sum(d.commits for d in developers),
        total_allocated_points=round(sum(d.allocated_story_points for d in developers), 2),
        total_done_tasks=total_done,
        total_tasks=total_tasks,
        avg_completion_pct=avg_completion,
        active_developers=len([d for d in developers if d.commits or d.total_tasks]),
    )


@app.get("/productivity/github-logins")
async def github_logins(db: Session = Depends(get_db)):
    """Distinct GitHub logins from commit metrics, with commit count and display name.
    Used to populate the handle-mapping dropdown on the Resources page."""
    rows = db.execute(text("""
        SELECT LOWER(TRIM(meta->>'author_login')) AS login,
               MAX(meta->>'author_name') AS display_name,
               COUNT(*)::int AS commits
        FROM metrics
        WHERE source = 'github'
          AND metric_type = 'commit'
          AND meta->>'author_login' IS NOT NULL
          AND TRIM(meta->>'author_login') <> ''
          AND meta->>'author_login' NOT LIKE '%[bot]%'
        GROUP BY LOWER(TRIM(meta->>'author_login'))
        ORDER BY commits DESC
    """)).mappings().all()
    return [{"login": r["login"], "display_name": r["display_name"], "commits": r["commits"]} for r in rows]


@app.get("/productivity/jira-assignees")
async def jira_assignees(db: Session = Depends(get_db)):
    """Distinct Jira assignees from metrics, with account_id, display name, open issue count."""
    rows = db.execute(text("""
        SELECT meta->>'assignee_login' AS account_id,
               MAX(meta->>'assignee_name') AS display_name,
               COALESCE(SUM((meta->>'issue_count')::int), 0)::int AS open_issues,
               COALESCE(SUM(value), 0)::float AS open_sp
        FROM metrics
        WHERE source = 'jira'
          AND metric_type = 'developer_open_story_points'
          AND meta->>'assignee_login' IS NOT NULL
          AND TRIM(meta->>'assignee_login') <> ''
        GROUP BY meta->>'assignee_login'
        ORDER BY open_issues DESC
    """)).mappings().all()
    return [
        {"account_id": r["account_id"], "display_name": r["display_name"],
         "open_issues": r["open_issues"], "open_sp": float(r["open_sp"] or 0)}
        for r in rows
    ]


@app.get("/productivity/jira-sprints")
async def list_jira_sprints(db: Session = Depends(get_db)):
    """All distinct Jira sprints available in the metrics DB."""
    rows = db.execute(text("""
        SELECT DISTINCT
               (meta->>'sprint_id')::int AS sprint_id,
               MAX(meta->>'sprint_name') AS sprint_name,
               MAX(meta->>'project') AS project
        FROM metrics
        WHERE source = 'jira'
          AND metric_type = 'sprint_points_per_developer'
          AND meta->>'sprint_id' IS NOT NULL
        GROUP BY (meta->>'sprint_id')::int
        ORDER BY (meta->>'sprint_id')::int DESC
    """)).mappings().all()
    return [{"sprint_id": r["sprint_id"], "sprint_name": r["sprint_name"], "project": r["project"]} for r in rows]


@app.get("/productivity/jira-sprint/{jira_sprint_id}")
async def jira_sprint_detail(jira_sprint_id: int, db: Session = Depends(get_db)):
    """Per-developer ticket breakdown for a specific Jira sprint ID."""
    rows = db.execute(text("""
        SELECT meta->>'assignee_name' AS developer,
               meta->>'assignee_login' AS account_id,
               MAX(meta->>'sprint_name') AS sprint_name,
               MAX(meta->>'project') AS project,
               COALESCE(SUM(value)::float, 0) AS total_sp,
               COALESCE(SUM((meta->>'completed_points')::float), 0) AS done_sp,
               COALESCE(SUM((meta->>'done_count')::int), 0) AS done_count
        FROM metrics
        WHERE source = 'jira'
          AND metric_type = 'sprint_points_per_developer'
          AND (meta->>'sprint_id')::int = :sprint_id
          AND meta->>'assignee_name' IS NOT NULL
        GROUP BY meta->>'assignee_name', meta->>'assignee_login'
        ORDER BY done_count DESC, meta->>'assignee_name'
    """), {"sprint_id": jira_sprint_id}).mappings().all()

    # Also get open issues for each assignee
    account_ids = [r["account_id"] for r in rows if r["account_id"]]
    open_rows = {}
    if account_ids:
        placeholders = ", ".join(f":aid{i}" for i in range(len(account_ids)))
        params = {f"aid{i}": aid for i, aid in enumerate(account_ids)}
        open_data = db.execute(text(f"""
            SELECT meta->>'assignee_login' AS account_id,
                   COALESCE(SUM((meta->>'issue_count')::int), 0)::int AS open_issues,
                   COALESCE(MAX((meta->>'done_count')::int), 0)::int AS done_issues
            FROM metrics
            WHERE source = 'jira'
              AND metric_type = 'developer_open_story_points'
              AND meta->>'assignee_login' IN ({placeholders})
            GROUP BY meta->>'assignee_login'
        """), params).mappings().all()
        open_rows = {r["account_id"]: r for r in open_data}

    return {
        "jira_sprint_id": jira_sprint_id,
        "sprint_name": rows[0]["sprint_name"] if rows else "",
        "project": rows[0]["project"] if rows else "",
        "developers": [
            {
                "developer": r["developer"],
                "account_id": r["account_id"],
                "total_sp": float(r["total_sp"] or 0),
                "done_sp": float(r["done_sp"] or 0),
                "done_count": int(r["done_count"] or 0),
                "open_issues": int((open_rows.get(r["account_id"]) or {}).get("open_issues", 0)),
            }
            for r in rows
        ],
    }


@app.get("/reports/sprint/{sprint_id}")
async def sprint_report(sprint_id: int, db: Session = Depends(get_db)):
    """PDF report for a planning sprint — allocations + Jira ticket breakdown."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT

    # Fetch sprint + allocations
    sprint_row = db.execute(text("SELECT * FROM sprints WHERE id = :id"), {"id": sprint_id}).mappings().first()
    if not sprint_row:
        raise HTTPException(status_code=404, detail="Sprint not found")

    alloc_rows = db.execute(text("""
        SELECT r.name, r.team, a.story_points, a.effective_hours, a.leave_days,
               COUNT(t.id)::int AS total_tasks,
               COUNT(t.id) FILTER (WHERE t.status='done')::int AS done_tasks
        FROM sprint_allocations a
        JOIN resources r ON r.id = a.resource_id
        LEFT JOIN allocation_tasks t ON t.allocation_id = a.id
        WHERE a.sprint_id = :sid
        GROUP BY r.name, r.team, a.story_points, a.effective_hours, a.leave_days
        ORDER BY r.team, r.name
    """), {"sid": sprint_id}).mappings().all()

    # Jira open/done per developer (matched via jira_account_id)
    jira_rows = db.execute(text("""
        SELECT r.name AS developer, r.team,
               COALESCE(MAX(CASE WHEN m.metric_type='developer_open_story_points'
                                 THEN (m.meta->>'issue_count')::int END), 0) AS open_issues,
               COALESCE(MAX(CASE WHEN m.metric_type='developer_open_story_points'
                                 THEN (m.meta->>'done_count')::int END), 0) +
               COALESCE(SUM(CASE WHEN m.metric_type='sprint_points_per_developer'
                                 THEN (m.meta->>'done_count')::int END), 0) AS done_issues
        FROM resources r
        JOIN sprint_allocations a ON a.resource_id = r.id AND a.sprint_id = :sid
        LEFT JOIN metrics m ON m.source='jira'
            AND m.metric_type IN ('developer_open_story_points','sprint_points_per_developer')
            AND m.meta->>'assignee_login' = r.jira_account_id
        WHERE r.jira_account_id IS NOT NULL
        GROUP BY r.name, r.team
    """), {"sid": sprint_id}).mappings().all()
    jira_map = {r["developer"]: r for r in jira_rows}

    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    sprint_name = sprint_row["name"] or f"Sprint {sprint_id}"
    start = str(sprint_row["start_date"] or "")
    end = str(sprint_row["end_date"] or "")

    # Bar chart — SP per developer
    names = [r["name"].split()[0] for r in alloc_rows]
    sps = [float(r["story_points"] or 0) for r in alloc_rows]
    fig, ax = plt.subplots(figsize=(8, 2.8))
    bars = ax.bar(names, sps, color="#6366f1", alpha=0.85)
    ax.set_ylabel("Story Points", fontsize=8)
    ax.set_title("Allocated Story Points per Developer", fontsize=9)
    ax.tick_params(axis="x", labelsize=7, rotation=30)
    ax.tick_params(axis="y", labelsize=7)
    ax.bar_label(bars, fmt="%.0f", fontsize=7)
    plt.tight_layout()
    chart_buf = io.BytesIO()
    plt.savefig(chart_buf, format="png", dpi=120, bbox_inches="tight")
    plt.close()
    chart_buf.seek(0)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=1.5*cm, rightMargin=1.5*cm, topMargin=1.5*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=16, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=11, spaceAfter=4, spaceBefore=10)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=8, textColor=colors.grey)
    story = []

    story.append(Paragraph(f"Sprint Report: {sprint_name}", h1))
    story.append(Paragraph(f"{start} → {end}  ·  Generated {now}", small))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.lightgrey, spaceAfter=8))

    # Summary row
    total_sp = sum(float(r["story_points"] or 0) for r in alloc_rows)
    total_eff = sum(float(r["effective_hours"] or 0) for r in alloc_rows)
    total_open = sum(int((jira_map.get(r["name"]) or {}).get("open_issues", 0)) for r in alloc_rows)
    total_done = sum(int((jira_map.get(r["name"]) or {}).get("done_issues", 0)) for r in alloc_rows)
    summary_data = [
        ["Developers", "Total SP", "Eff Hours", "Jira Open", "Jira Done"],
        [str(len(alloc_rows)), f"{total_sp:.0f}", f"{total_eff:.0f}", str(total_open), str(total_done)],
    ]
    summary_table = Table(summary_data, colWidths=[3*cm]*5)
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#6366f1")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.HexColor("#f8f8ff"), colors.white]),
        ("BOX", (0,0), (-1,-1), 0.5, colors.lightgrey),
        ("FONTNAME", (0,1), (-1,-1), "Helvetica-Bold"),
        ("FONTSIZE", (0,1), (-1,-1), 12),
    ]))
    story.append(summary_table)

    # SP chart
    story.append(Paragraph("Story Point Allocation", h2))
    story.append(RLImage(chart_buf, width=16*cm, height=5.5*cm))

    # Allocation + Jira table
    story.append(Paragraph("Developer Breakdown", h2))
    headers = ["Developer", "Team", "Alloc SP", "Eff Hrs", "Leave", "Tasks", "Jira Open", "Jira Done"]
    col_w = [3.5*cm, 2.5*cm, 1.8*cm, 1.8*cm, 1.5*cm, 1.5*cm, 2*cm, 2*cm]
    table_data = [headers]
    for r in alloc_rows:
        j = jira_map.get(r["name"]) or {}
        table_data.append([
            r["name"], r["team"],
            f"{float(r['story_points'] or 0):.0f}",
            f"{float(r['effective_hours'] or 0):.0f}",
            f"{float(r['leave_days'] or 0):.0f}",
            f"{r['done_tasks']}/{r['total_tasks']}",
            str(j.get("open_issues", "—")),
            str(j.get("done_issues", "—")),
        ])
    alloc_table = Table(table_data, colWidths=col_w)
    alloc_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#1e1b4b")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTSIZE", (0,0), (-1,-1), 8),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.HexColor("#f5f5ff"), colors.white]),
        ("BOX", (0,0), (-1,-1), 0.5, colors.lightgrey),
        ("INNERGRID", (0,0), (-1,-1), 0.25, colors.lightgrey),
        ("ALIGN", (2,0), (-1,-1), "CENTER"),
    ]))
    story.append(alloc_table)
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(f"CTO Dash  ·  {now}", small))

    doc.build(story)
    buf.seek(0)
    filename = sprint_name.replace(" ", "_").replace("/", "-")
    return StreamingResponse(buf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="sprint_{filename}.pdf"'})


@app.get("/productivity/sprint-jira/{sprint_id}")
async def sprint_jira_tickets(sprint_id: int, db: Session = Depends(get_db)):
    """Jira open + done ticket counts per developer for a planning sprint.
    Matches via resources.jira_account_id mapped to that sprint's allocations."""
    rows = db.execute(text("""
        SELECT r.name AS developer, r.team, r.jira_account_id,
               -- open issues
               COALESCE(MAX(CASE WHEN m.metric_type = 'developer_open_story_points'
                                 THEN (m.meta->>'issue_count')::int END), 0) AS open_issues,
               COALESCE(MAX(CASE WHEN m.metric_type = 'developer_open_story_points'
                                 THEN (m.meta->>'done_count')::int END), 0) AS done_issues,
               COALESCE(MAX(CASE WHEN m.metric_type = 'developer_open_story_points'
                                 THEN value END), 0) AS open_sp,
               COALESCE(MAX(CASE WHEN m.metric_type = 'developer_open_story_points'
                                 THEN (m.meta->>'done_points')::float END), 0) AS done_sp,
               -- sprint completed points (from Jira sprint_points_per_developer)
               COALESCE(SUM(CASE WHEN m.metric_type = 'sprint_points_per_developer'
                                 THEN (m.meta->>'completed_points')::float END), 0) AS sprint_done_sp,
               COALESCE(SUM(CASE WHEN m.metric_type = 'sprint_points_per_developer'
                                 THEN (m.meta->>'done_count')::int END), 0) AS sprint_done_count,
               -- planning allocation
               a.story_points AS alloc_sp,
               a.effective_hours
        FROM resources r
        JOIN sprint_allocations a ON a.resource_id = r.id AND a.sprint_id = :sprint_id
        LEFT JOIN metrics m ON m.source = 'jira'
            AND m.metric_type IN ('developer_open_story_points', 'sprint_points_per_developer')
            AND m.meta->>'assignee_login' = r.jira_account_id
        WHERE r.jira_account_id IS NOT NULL
        GROUP BY r.id, r.name, r.team, r.jira_account_id, a.story_points, a.effective_hours
        ORDER BY r.name
    """), {"sprint_id": sprint_id}).mappings().all()

    return [
        {
            "developer": r["developer"],
            "team": r["team"],
            "jira_account_id": r["jira_account_id"],
            "open_issues": int(r["open_issues"] or 0),
            "done_issues": int(r["done_issues"] or 0) + int(r["sprint_done_count"] or 0),
            "open_sp": float(r["open_sp"] or 0),
            "done_sp": float(r["done_sp"] or 0) + float(r["sprint_done_sp"] or 0),
            "alloc_sp": float(r["alloc_sp"] or 0),
            "effective_hours": float(r["effective_hours"] or 0),
        }
        for r in rows
    ]


@app.get("/productivity/sprint-velocity")
async def sprint_velocity_per_developer(db: Session = Depends(get_db)):
    """Per-developer allocated SP across sprints, for velocity trend chart."""
    rows = db.execute(text("""
        SELECT s.id AS sprint_id, s.name AS sprint_name, s.start_date,
               r.name AS developer, r.team,
               COALESCE(a.story_points, 0)::float AS sp,
               COALESCE(a.effective_hours, 0)::float AS eff_hours
        FROM sprints s
        JOIN sprint_allocations a ON a.sprint_id = s.id
        JOIN resources r ON r.id = a.resource_id
        WHERE r.is_active = true
        ORDER BY s.start_date NULLS LAST, s.id, r.name
    """)).mappings().all()
    # Pivot: { developer -> [{ sprint, sp, eff_hours }] }
    by_dev: dict[str, dict] = {}
    sprints_seen: dict[int, str] = {}
    for r in rows:
        sprints_seen[r["sprint_id"]] = r["sprint_name"] or f"Sprint {r['sprint_id']}"
        dev = r["developer"]
        if dev not in by_dev:
            by_dev[dev] = {"team": r["team"], "sprints": {}}
        by_dev[dev]["sprints"][r["sprint_id"]] = {"sp": r["sp"], "eff_hours": r["eff_hours"]}
    sprint_list = [{"id": sid, "name": sname} for sid, sname in sorted(sprints_seen.items())]
    developers = [
        {"name": dev, "team": data["team"], "sprints": data["sprints"]}
        for dev, data in sorted(by_dev.items())
    ]
    return {"sprints": sprint_list, "developers": developers}


@app.get("/productivity/trends", response_model=schemas.ProductivityTrend)
async def productivity_trends(
    metric: str = Query("commits", description="commits | velocity"),
    dateRange: str | None = Query("90d"),
    db: Session = Depends(get_db),
):
    """Time-bucketed trend for charts, aggregated in SQL."""
    window = parse_window(dateRange)
    points: list[schemas.ProductivityTrendPoint] = []

    if metric == "commits":
        params: dict[str, Any] = {}
        where = ["source = 'github'", "metric_type = 'commit'"]
        if window is not None:
            where.append("timestamp >= :win")
            params["win"] = window
        rows = db.execute(text(f"""
            SELECT to_char(date_trunc('day', timestamp), 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
            FROM metrics WHERE {' AND '.join(where)}
            GROUP BY day ORDER BY day
        """), params).mappings().all()
        points = [schemas.ProductivityTrendPoint(label=r["day"][5:], value=r["n"]) for r in rows]

    elif metric == "velocity":
        rows = db.execute(text("""
            SELECT s.name AS sprint, COALESCE(SUM(a.story_points), 0)::float AS sp
            FROM sprints s
            LEFT JOIN sprint_allocations a ON a.sprint_id = s.id
            GROUP BY s.id, s.name, s.start_date
            ORDER BY s.start_date NULLS LAST, s.id
        """)).mappings().all()
        points = [schemas.ProductivityTrendPoint(label=(r["sprint"] or "")[:18], value=r["sp"]) for r in rows]

    return schemas.ProductivityTrend(metric=metric, points=points)


@app.get("/events", response_model=list[schemas.EventOut])
async def list_events(
    source: str | None = None,
    event_type: str | None = None,
    dateRange: str | None = Query(None, description="24h, 7d, 30d, 90d"),
    squad: str | None = Query(None),
    environment: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Event)
    if source:
        q = q.filter(Event.source == source)
    if event_type:
        q = q.filter(Event.event_type == event_type)
    if dateRange:
        window = parse_window(dateRange)
        if window:
            q = q.filter(Event.happened_at >= window)
    if squad and squad != "all":
        q = q.filter((Event.entity.ilike(f"%{squad}%")) | (Event.meta.cast(JSONB).op("@>")({"squad": squad})))
    if environment and environment != "all":
        q = q.filter(Event.meta.cast(JSONB).op("@>")({"environment": environment}))
    return q.order_by(Event.happened_at.desc()).all()


async def event_stream(
    db: Session,
    dateRange: str | None = None,
    squad: str | None = None,
    environment: str | None = None,
):
    """Async generator for server-sent events of recent incidents and alerts."""
    last_id = 0
    while True:
        q = db.query(Event).filter(Event.event_type.in_(["incident", "alert", "outage", "security_alert", "cost_driver"]))
        if dateRange:
            window = parse_window(dateRange)
            if window:
                q = q.filter(Event.happened_at >= window)
        if squad and squad != "all":
            q = q.filter((Event.entity.ilike(f"%{squad}%")) | (Event.meta.cast(JSONB).op("@>")({"squad": squad})))
        if environment and environment != "all":
            q = q.filter(Event.meta.cast(JSONB).op("@>")({"environment": environment}))

        events = (
            q.filter(Event.id > last_id)
            .order_by(Event.happened_at.desc())
            .limit(50)
            .all()
        )
        if events:
            last_id = max(e.id for e in events)
            payload = [schemas.EventOut.model_validate(e).model_dump(mode="json") for e in events]
            yield f"data: {json.dumps({'events': payload})}\n\n"

        # Heartbeat comment to keep connection alive through proxies.
        yield ":heartbeat\n\n"
        await asyncio.sleep(10)


@app.get("/events/stream")
async def events_stream(
    dateRange: str | None = Query(None, description="24h, 7d, 30d, 90d"),
    squad: str | None = Query(None),
    environment: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Server-sent events feed for live incidents and alerts."""
    return StreamingResponse(
        event_stream(db, dateRange=dateRange, squad=squad, environment=environment),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/reports/newsletter")
async def download_newsletter(db: Session = Depends(get_db)):
    """Generate and download the 7-day tech newsletter as a PDF."""
    try:
        pdf_bytes = generate_newsletter_pdf(db)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate newsletter: {exc}") from exc

    filename = f"cto-dash-newsletter-{datetime.utcnow().date().isoformat()}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )
