import datetime as dt
from typing import Any, Dict, List

import httpx

from backend.mcp.integrations.base import Connector
from backend.mcp.integrations.observability_datadog import (
    datadog_health_check,
    fetch_datadog_events,
    fetch_datadog_metrics,
)
from backend.mcp.integrations.observability_newrelic import (
    fetch_newrelic_events,
    fetch_newrelic_metrics,
    newrelic_health_check,
)


class ObservabilityConnector(Connector):
    name = "observability"
    required_env = ["OBSERVABILITY_PROVIDER"]

    def __init__(self, config: Dict[str, Any] | None = None):
        self.config = config or {}
        self.provider = str(self.config.get("OBSERVABILITY_PROVIDER", "datadog")).lower()

        # Datadog-specific fields.
        self.dd_api_key = self.config.get("DD_API_KEY", "")
        self.dd_app_key = self.config.get("DD_APP_KEY", "")
        self.dd_site = self.config.get("DD_SITE", "datadoghq.com")

        # New Relic-specific fields.
        self.nr_api_key = self.config.get("NR_API_KEY", "")
        self.nr_account_id = self.config.get("NR_ACCOUNT_ID", "")

    async def health_check(self) -> Dict[str, Any]:
        if self.provider == "datadog":
            return await datadog_health_check(self.config)
        if self.provider == "newrelic":
            return await newrelic_health_check(self.config)
        return {"ok": False, "error": f"Unknown provider: {self.provider}"}

    async def fetch_metrics(self) -> List[Dict[str, Any]]:
        if self.provider == "datadog":
            async with httpx.AsyncClient(
                headers={
                    "DD-API-KEY": self.dd_api_key,
                    "DD-APPLICATION-KEY": self.dd_app_key,
                    "Accept": "application/json",
                }
            ) as client:
                metrics = await fetch_datadog_metrics(client, self.config)
            if not metrics:
                # No real data yet; emit a placeholder so the configured provider is visible.
                metrics = [
                    {
                        "source": "datadog",
                        "metric_type": "configured_provider",
                        "entity": "observability",
                        "value": 1,
                        "value_text": self.dd_site,
                        "timestamp": dt.datetime.utcnow().isoformat(),
                    }
                ]
            return metrics

        if self.provider == "newrelic":
            async with httpx.AsyncClient(
                headers={
                    "API-Key": self.nr_api_key,
                    "Content-Type": "application/json",
                }
            ) as client:
                metrics = await fetch_newrelic_metrics(client, self.config)
            if not metrics:
                metrics = [
                    {
                        "source": "newrelic",
                        "metric_type": "configured_provider",
                        "entity": "observability",
                        "value": 1,
                        "value_text": "newrelic",
                        "timestamp": dt.datetime.utcnow().isoformat(),
                    }
                ]
            return metrics

        return []

    async def fetch_events(self) -> List[Dict[str, Any]]:
        if self.provider == "datadog":
            async with httpx.AsyncClient(
                headers={
                    "DD-API-KEY": self.dd_api_key,
                    "DD-APPLICATION-KEY": self.dd_app_key,
                    "Accept": "application/json",
                }
            ) as client:
                return await fetch_datadog_events(client, self.config)

        if self.provider == "newrelic":
            async with httpx.AsyncClient(
                headers={
                    "API-Key": self.nr_api_key,
                    "Content-Type": "application/json",
                }
            ) as client:
                return await fetch_newrelic_events(client, self.config)

        return []
