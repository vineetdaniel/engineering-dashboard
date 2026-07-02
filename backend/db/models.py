import datetime as dt
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Text, Boolean, create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import QueuePool
from backend.config import settings

Base = declarative_base()


# Build engine args from settings. In production, enable SSL and pool pre-ping
# so dropped connections are detected before being handed out.
_engine_kwargs = {
    "poolclass": QueuePool,
    "pool_pre_ping": True,
    "pool_recycle": 1800,
}
if settings.DATABASE_REQUIRE_SSL:
    _engine_kwargs["connect_args"] = {"sslmode": "require"}

engine = create_engine(str(settings.DATABASE_URL), **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Metric(Base):
    __tablename__ = "metrics"
    id = Column(Integer, primary_key=True, index=True)
    source = Column(String(50), index=True, nullable=False)
    metric_type = Column(String(100), index=True, nullable=False)
    entity = Column(String(200), nullable=True)
    value = Column(Float, nullable=True)
    value_text = Column(Text, nullable=True)
    meta = Column(JSON, default=dict)
    timestamp = Column(DateTime, default=dt.datetime.utcnow, index=True)
    is_seed = Column(Boolean, default=False, nullable=False, index=True)


class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    source = Column(String(50), index=True, nullable=False)
    event_type = Column(String(100), index=True, nullable=False)
    entity = Column(String(200), nullable=True)
    title = Column(Text, nullable=False)
    severity = Column(String(20), nullable=True)
    status = Column(String(50), nullable=True)
    meta = Column(JSON, default=dict)
    happened_at = Column(DateTime, default=dt.datetime.utcnow, index=True)
    is_seed = Column(Boolean, default=False, nullable=False, index=True)


class ConnectorConfig(Base):
    __tablename__ = "connector_configs"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    config = Column(JSON, default=dict, nullable=False)
    updated_at = Column(DateTime, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow)


# Indexes that support the per-developer productivity rollups. The `meta`
# column is JSON, so we index its extracted text fields. These are functional
# B-tree indexes partial-filtered by source to stay small. Idempotent.
_PRODUCTIVITY_INDEXES = [
    "CREATE INDEX IF NOT EXISTS ix_metrics_author_name "
    "ON metrics ((meta ->> 'author_name')) WHERE source = 'github'",
    "CREATE INDEX IF NOT EXISTS ix_metrics_assignee_name "
    "ON metrics ((meta ->> 'assignee_name')) WHERE source = 'jira'",
    "CREATE INDEX IF NOT EXISTS ix_metrics_source_type_ts "
    "ON metrics (source, metric_type, timestamp)",
]


def init_db():
    Base.metadata.create_all(bind=engine)
    # Productivity rollup indexes (Postgres only; skipped silently otherwise).
    try:
        with engine.begin() as conn:
            for stmt in _PRODUCTIVITY_INDEXES:
                conn.execute(text(stmt))
    except Exception:
        # Index creation is a performance optimization, not correctness — never
        # block startup on it (e.g. non-Postgres backends or permission issues).
        pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
