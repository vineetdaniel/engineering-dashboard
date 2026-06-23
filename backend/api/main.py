from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.api import schemas
from backend.config import settings
from backend.db.models import init_db, get_db, Metric, Event
from backend.mcp.integrations import CONNECTORS


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="CTO Dash API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.APP_ENV == "development" else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/settings")
async def app_settings():
    return {
        "observability_provider": settings.OBSERVABILITY_PROVIDER,
        "jira_project_keys": settings.JIRA_PROJECT_KEYS.split(",") if settings.JIRA_PROJECT_KEYS else [],
        "github_org": settings.GITHUB_ORG,
    }


@app.get("/connectors/health", response_model=schemas.ConnectorHealthResponse)
async def connectors_health():
    results = {}
    for name, cls in CONNECTORS.items():
        conn = cls()
        results[name] = await conn.health_check()
    return {"connectors": results}


@app.post("/sync/{source}")
async def sync_source(source: str, db: Session = Depends(get_db)):
    if source not in CONNECTORS:
        raise HTTPException(status_code=404, detail=f"Unknown source: {source}")

    conn = CONNECTORS[source]()
    health = await conn.health_check()
    if not health["ok"]:
        raise HTTPException(status_code=400, detail=health)

    metrics = await conn.fetch_metrics()
    events = await conn.fetch_events()

    for m in metrics:
        db.add(Metric(**m))
    for e in events:
        db.add(Event(**e))

    db.commit()
    return {"source": source, "metrics": len(metrics), "events": len(events)}


@app.get("/metrics", response_model=list[schemas.MetricOut])
async def list_metrics(source: str | None = None, metric_type: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Metric)
    if source:
        q = q.filter(Metric.source == source)
    if metric_type:
        q = q.filter(Metric.metric_type == metric_type)
    return q.order_by(Metric.timestamp.desc()).limit(500).all()


@app.get("/events", response_model=list[schemas.EventOut])
async def list_events(source: str | None = None, event_type: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Event)
    if source:
        q = q.filter(Event.source == source)
    if event_type:
        q = q.filter(Event.event_type == event_type)
    return q.order_by(Event.happened_at.desc()).limit(500).all()
