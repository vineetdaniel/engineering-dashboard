from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class MetricOut(BaseModel):
    id: int
    source: str
    metric_type: str
    entity: Optional[str]
    value: Optional[float]
    value_text: Optional[str]
    meta: Dict[str, Any]
    timestamp: datetime
    is_seed: bool = False

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
    happened_at: datetime
    is_seed: bool = False

    class Config:
        from_attributes = True


class ConnectorHealthResponse(BaseModel):
    connectors: Dict[str, Dict[str, Any]]


class ConnectorConfigOut(BaseModel):
    name: str
    configured: bool
    config: Dict[str, Any]
    required: List[str]


class ConnectorGuideStep(BaseModel):
    label: str
    description: str


class ConnectorGuideField(BaseModel):
    key: str
    label: str
    type: str
    required: bool
    placeholder: Optional[str] = None
    help: Optional[str] = None
    secret: bool = False


class ConnectorGuideOut(BaseModel):
    name: str
    label: str
    description: str
    docs_url: Optional[str] = None
    fields: List[ConnectorGuideField]
    steps: List[ConnectorGuideStep]


class ConnectorSaveOut(BaseModel):
    name: str
    configured: bool
    config: Dict[str, Any]
    health: Dict[str, Any]


class ComplianceUploadOut(BaseModel):
    source: str
    metrics: int
    events: int
    errors: List[str]
