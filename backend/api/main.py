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
    results = {}
    for name, cls in CONNECTORS.items():
        try:
            conn = _connector_with_config(name, db)
            results[name] = await conn.health_check()
        except Exception as exc:
            results[name] = {"ok": False, "error": str(exc)}
    return {"connectors": results}


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

    # Remove any previous data for this source (seed or real) so each sync is idempotent.
    db.query(Metric).filter(Metric.source == source).delete(synchronize_session=False)
    db.query(Event).filter(Event.source == source).delete(synchronize_session=False)

    for m in metrics:
        db.add(Metric(**{**m, "is_seed": False}))
    for e in events:
        db.add(Event(**{**e, "is_seed": False}))

    db.commit()

    from collections import Counter
    metric_breakdown = dict(Counter(m.get("metric_type", "unknown") for m in metrics))
    event_breakdown = dict(Counter(e.get("event_type", "unknown") for e in events))

    return {
        "source": source,
        "metrics": len(metrics),
        "events": len(events),
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
