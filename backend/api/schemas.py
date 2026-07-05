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


class DeveloperProductivity(BaseModel):
    resource_id: Optional[int] = None
    name: str
    team: Optional[str] = None
    role: Optional[str] = None
    # Planning signals
    allocated_story_points: float = 0
    effective_hours: float = 0
    total_tasks: int = 0
    done_tasks: int = 0
    completion_pct: float = 0
    sp_per_effective_hour: Optional[float] = None
    category_mix: Dict[str, int] = {}
    # Connector signals (joined by exact account id or fuzzy name)
    commits: int = 0
    lines_added: int = 0
    lines_deleted: int = 0
    jira_done_points: float = 0
    jira_open_points: float = 0
    jira_open_issues: int = 0
    jira_done_issues: int = 0
    matched: bool = True  # False = a connector identity with no planning resource


class ProductivitySummary(BaseModel):
    developers: List[DeveloperProductivity]
    unmatched: List[DeveloperProductivity]
    total_commits: int = 0
    total_allocated_points: float = 0
    total_done_tasks: int = 0
    total_tasks: int = 0
    avg_completion_pct: float = 0
    active_developers: int = 0


class ProductivityTrendPoint(BaseModel):
    label: str
    value: float


class ProductivityTrend(BaseModel):
    metric: str
    points: List[ProductivityTrendPoint]


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


class ApiFilters(BaseModel):
    dateRange: Optional[str] = None
    squad: Optional[str] = None
    environment: Optional[str] = None


class StrategyGoals(BaseModel):
    six_month: str
    quarterly: str
    weekly: str
    ai_strategy_focus: str
    top_risks: str
    growth_levers: str
    team_capacity_notes: str


class StrategySaveIn(BaseModel):
    goals: StrategyGoals


class StrategyOut(BaseModel):
    goals: StrategyGoals
    updated_at: Optional[datetime] = None


class StrategyActionItem(BaseModel):
    id: str
    title: str
    rationale: str
    section: str
    priority: str
    owner: Optional[str] = None
    due_hint: Optional[str] = None


class HealthScoreDimension(BaseModel):
    score: float
    label: str
    signals: Dict[str, Any]


class HealthScoreOut(BaseModel):
    score: float
    label: str
    dimensions: Dict[str, HealthScoreDimension]


class GoalMetricCard(BaseModel):
    id: str
    goal_key: str
    title: str
    aim: str
    metric_type: str
    metric_label: str
    target: str
    target_value: float
    direction: str
    current: Optional[float]
    progress: Optional[float]
    status: str
    section: str
    owner: str
    weight: float


class InitiativeBucket(BaseModel):
    id: str
    key: str
    label: str
    description: str
    status: str
    open_items: int
    critical_items: int
    high_items: int
    near_term_items: int
    action_ids: List[str]
    sections: List[str]


class StrategyGenerateOut(BaseModel):
    narrative: str
    action_items: List[StrategyActionItem]
    health_score: HealthScoreOut
    goal_cards: List[GoalMetricCard]
    initiative_portfolio: List[InitiativeBucket]
    data_driven: bool
    llm_enhanced: bool
