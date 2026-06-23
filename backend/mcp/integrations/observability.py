import datetime as dt
import os
from typing import Any, Dict, List

import httpx

from backend.config import settings
from backend.mcp.integrations.base import Connector


class ObservabilityConnector(Connector):
    name = "observability"
    required_env = ["OBSERVABILITY_PROVIDER"]

    def __init__(self):
        self.provider = settings.OBSERVABILITY_PROVIDER.lower()

    async def health_check(self) -> Dict[str, Any]:
        if self.provider == "datadog":
            return await self._dd_health()
        if self.provider == "newrelic":
            return await self._nr_health()
        return {"ok": False, "error": f"Unknown provider: {self.provider}"}

    async def fetch_metrics(self) -> List[Dict[str, Any]]:
        if self.provider == "datadog":
            return await self._dd_metrics()
        if self.provider == "newrelic":
            return await self._nr_metrics()
        return []

    async def fetch_events(self) -> List[Dict[str, Any]]:
        if self.provider == "datadog":
            return await self._dd_events()
        if self.provider == "newrelic":
            return await self._nr_events()
        return []

    # --- Datadog implementation ---

    async def _dd_health(self) -> Dict[str, Any]:
        if not settings.DD_API_KEY or not settings.DD_APP_KEY:
            return {"ok": False, "error": "DD_API_KEY and DD_APP_KEY required"}
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"https://api.{settings.DD_SITE}/api/v1/validate",
                headers={"DD-API-KEY": settings.DD_API_KEY, "DD-APPLICATION-KEY": settings.DD_APP_KEY},
            )
            if r.status_code == 200:
                return {"ok": True, "error": None}
            return {"ok": False, "error": f"HTTP {r.status_code}: {r.text}"}

    async def _dd_metrics(self) -> List[Dict[str, Any]]:
        # Placeholder: query an APM service for error rate/latency
        return [
            {
                "source": "datadog",
                "metric_type": "configured_provider",
                "entity": "observability",
                "value": 1,
                "value_text": settings.DD_SITE,
                "timestamp": dt.datetime.utcnow().isoformat(),
            }
        ]

    async def _dd_events(self) -> List[Dict[str, Any]]:
        return []

    # --- New Relic implementation (configurable, not yet active) ---

    async def _nr_health(self) -> Dict[str, Any]:
        if not settings.NR_API_KEY or not settings.NR_ACCOUNT_ID:
            return {"ok": False, "error": "NR_API_KEY and NR_ACCOUNT_ID required"}
        async with httpx.AsyncClient() as client:
            r = await client.get(
                "https://api.newrelic.com/graphql",
                headers={"API-Key": settings.NR_API_KEY, "Content-Type": "application/json"},
            )
            if r.status_code == 200:
                return {"ok": True, "error": None}
            return {"ok": False, "error": f"HTTP {r.status_code}: {r.text}"}

    async def _nr_metrics(self) -> List[Dict[str, Any]]:
        return [
            {
                "source": "newrelic",
                "metric_type": "configured_provider",
                "entity": "observability",
                "value": 1,
                "value_text": "newrelic",
                "timestamp": dt.datetime.utcnow().isoformat(),
            }
        ]

    async def _nr_events(self) -> List[Dict[str, Any]]:
        return []
