import datetime as dt
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Text, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.config import settings

Base = declarative_base()
engine = create_engine(str(settings.DATABASE_URL))
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


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
