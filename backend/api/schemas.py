from typing import Any, Dict, Optional
from pydantic import BaseModel


class MetricOut(BaseModel):
    id: int
    source: str
    metric_type: str
    entity: Optional[str]
    value: Optional[float]
    value_text: Optional[str]
    meta: Dict[str, Any]
    timestamp: str

    class Config:
        from_attributes = True


class EventOut(BaseModel):
    id: int
    source: str
    event_type: str
    entity: Optional[str]
    title: str
    severity: Optional[str]
    status: Optional[str]
    meta: Dict[str, Any]
    happened_at: str

    class Config:
        from_attributes = True


class ConnectorHealthResponse(BaseModel):
    connectors: Dict[str, Dict[str, Any]]
