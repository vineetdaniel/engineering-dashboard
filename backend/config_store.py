"""Runtime connector configuration store.

Connector configs are layered: environment variables provide the defaults, and
per-connector JSON stored in the database can override them. Secrets are masked
before being sent to the frontend.
"""

from typing import Any, Dict, List, Optional

from backend.config import settings
from backend.db.models import ConnectorConfig


# Keys whose values should never be returned to clients.
_SECRET_KEYS = {
    "GITHUB_TOKEN",
    "JIRA_API_TOKEN",
    "DD_API_KEY",
    "DD_APP_KEY",
    "NR_API_KEY",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "PAGERDUTY_API_KEY",
    "SLACK_WEBHOOK_URL",
    "JENKINS_API_KEY",
}

# Environment-driven defaults per connector. Must stay in sync with
# backend/config.py and the connector classes.
_CONNECTOR_DEFAULTS: Dict[str, Dict[str, Any]] = {
    "aws_cost": {
        "AWS_ACCESS_KEY_ID": settings.AWS_ACCESS_KEY_ID,
        "AWS_SECRET_ACCESS_KEY": settings.AWS_SECRET_ACCESS_KEY,
        "AWS_SESSION_TOKEN": settings.AWS_SESSION_TOKEN,
        "AWS_REGION": settings.AWS_REGION,
        "AWS_SERVICES": settings.AWS_SERVICES,
        "AWS_MONTHLY_BUDGET": settings.AWS_MONTHLY_BUDGET,
        "AWS_COST_DELTA_THRESHOLD_PCT": settings.AWS_COST_DELTA_THRESHOLD_PCT,
        "AWS_COST_CRITICAL_RISK_THRESHOLD_PCT": settings.AWS_COST_CRITICAL_RISK_THRESHOLD_PCT,
        "AWS_COST_TOP_DRIVERS_COUNT": settings.AWS_COST_TOP_DRIVERS_COUNT,
    },
    "github": {
        "GITHUB_TOKEN": settings.GITHUB_TOKEN,
        "GITHUB_ORG": settings.GITHUB_ORG,
    },
    "jenkins": {
        "JENKINS_URL": settings.JENKINS_URL,
        "JENKINS_USERNAME": settings.JENKINS_USERNAME,
        "JENKINS_API_KEY": settings.JENKINS_API_KEY,
    },
    "jira": {
        "JIRA_SERVER": settings.JIRA_SERVER,
        "JIRA_USERNAME": settings.JIRA_USERNAME,
        "JIRA_API_TOKEN": settings.JIRA_API_TOKEN,
        "JIRA_PROJECT_KEYS": settings.JIRA_PROJECT_KEYS,
    },
    "observability": {
        "OBSERVABILITY_PROVIDER": settings.OBSERVABILITY_PROVIDER,
        "DD_API_KEY": settings.DD_API_KEY,
        "DD_APP_KEY": settings.DD_APP_KEY,
        "DD_SITE": settings.DD_SITE,
        "DD_SERVICES": settings.DD_SERVICES,
        "DD_ENVIRONMENT": settings.DD_ENVIRONMENT,
        "DD_UPTIME_QUERY": settings.DD_UPTIME_QUERY,
        "DD_LATENCY_QUERY": settings.DD_LATENCY_QUERY,
        "DD_P99_LATENCY_QUERY": settings.DD_P99_LATENCY_QUERY,
        "DD_ERROR_RATE_QUERY": settings.DD_ERROR_RATE_QUERY,
        "DD_TRANSACTION_VOLUME_QUERY": settings.DD_TRANSACTION_VOLUME_QUERY,
        "NR_API_KEY": settings.NR_API_KEY,
        "NR_ACCOUNT_ID": settings.NR_ACCOUNT_ID,
        "NR_SERVICES": settings.NR_SERVICES,
        "NR_ENVIRONMENT": settings.NR_ENVIRONMENT,
        "NR_TRANSACTION_VOLUME_QUERY": settings.NR_TRANSACTION_VOLUME_QUERY,
    },
}

# Required fields per connector (same semantics as required_env on connector classes).
_CONNECTOR_REQUIRED: Dict[str, List[str]] = {
    "aws_cost": ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"],
    "github": ["GITHUB_TOKEN", "GITHUB_ORG"],
    "jenkins": ["JENKINS_URL", "JENKINS_API_KEY"],
    "jira": ["JIRA_SERVER", "JIRA_USERNAME", "JIRA_API_TOKEN", "JIRA_PROJECT_KEYS"],
    "observability": ["OBSERVABILITY_PROVIDER"],
}


def _is_configured(name: str, config: Dict[str, Any]) -> bool:
    """Return True when all required fields for the connector are non-empty."""
    for key in _CONNECTOR_REQUIRED.get(name, []):
        value = config.get(key)
        if value is None or (isinstance(value, str) and not value.strip()):
            return False
    # Provider-specific required secrets.
    if name == "observability":
        provider = str(config.get("OBSERVABILITY_PROVIDER", "")).lower()
        if provider == "datadog" and (not config.get("DD_API_KEY") or not config.get("DD_APP_KEY")):
            return False
        if provider == "newrelic" and (not config.get("NR_API_KEY") or not config.get("NR_ACCOUNT_ID")):
            return False
    return True


def mask_secrets(config: Dict[str, Any]) -> Dict[str, Any]:
    """Mask known secret values so configs can be returned safely."""
    masked: Dict[str, Any] = {}
    for key, value in config.items():
        if key in _SECRET_KEYS and value:
            masked[key] = "•" * min(len(str(value)), 12)
        else:
            masked[key] = value
    return masked


def get_connector_defaults(name: str) -> Dict[str, Any]:
    """Return the env-driven default config for a connector."""
    return dict(_CONNECTOR_DEFAULTS.get(name, {}))


def get_connector_config(name: str, db) -> Dict[str, Any]:
    """Return merged config for a connector (env defaults + DB override)."""
    merged = get_connector_defaults(name)
    row = db.query(ConnectorConfig).filter(ConnectorConfig.name == name).first()
    if row and row.config:
        merged.update({k: v for k, v in row.config.items() if v is not None})
    return merged


def set_connector_config(name: str, config: Dict[str, Any], db) -> ConnectorConfig:
    """Upsert a connector config row."""
    row = db.query(ConnectorConfig).filter(ConnectorConfig.name == name).first()
    if row is None:
        row = ConnectorConfig(name=name, config=config)
        db.add(row)
    else:
        row.config = config
    db.commit()
    db.refresh(row)
    return row


def list_connector_configs(db) -> List[Dict[str, Any]]:
    """Return summary rows for all known connectors."""
    rows = {r.name: r.config for r in db.query(ConnectorConfig).all()}
    result = []
    for name in _CONNECTOR_DEFAULTS:
        merged = get_connector_defaults(name)
        merged.update({k: v for k, v in rows.get(name, {}).items() if v is not None})
        result.append(
            {
                "name": name,
                "configured": _is_configured(name, merged),
                "config": mask_secrets(merged),
                "required": _CONNECTOR_REQUIRED.get(name, []),
            }
        )
    return result
