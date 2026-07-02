import datetime as dt
import re
from typing import Any, Dict, List, Set

import httpx

from backend.mcp.integrations.base import Connector


class MixpanelConnector(Connector):
    name = "mixpanel"
    required_env = ["MIXPANEL_API_SECRET"]

    def __init__(self, config: Dict[str, Any] | None = None):
        self.config = config or {}
        self.api_secret = str(self.config.get("MIXPANEL_API_SECRET", ""))
        self.api_key = str(self.config.get("MIXPANEL_API_KEY", ""))
        self.project_id = str(self.config.get("MIXPANEL_PROJECT_ID", ""))

    def _auth(self) -> tuple[str, str]:
        """Return Basic auth credentials. Mixpanel uses API secret or key as username."""
        if self.api_secret:
            return (self.api_secret, "")
        return (self.api_key, "")

    async def health_check(self) -> Dict[str, Any]:
        if not self.api_secret and not self.api_key:
            return {"ok": False, "error": "MIXPANEL_API_SECRET or MIXPANEL_API_KEY required"}
        async with httpx.AsyncClient() as client:
            try:
                r = await client.get(
                    "https://mixpanel.com/api/2.0/engage/properties",
                    auth=self._auth(),
                    timeout=15,
                )
                if r.status_code == 200:
                    return {"ok": True, "error": None}
                return {"ok": False, "error": f"HTTP {r.status_code}: {r.text[:200]}"}
            except Exception as exc:
                return {"ok": False, "error": str(exc)}

    async def fetch_metrics(self) -> List[Dict[str, Any]]:
        event_names = await self.list_event_names()
        counts = await self._fetch_event_counts(event_names)
        metrics: List[Dict[str, Any]] = []
        now = dt.datetime.utcnow().isoformat()

        def find(names: Set[str], patterns: List[str]) -> str:
            for pat in patterns:
                for name in names:
                    if re.search(pat, name, re.IGNORECASE):
                        return name
            return ""

        def total_for(patterns: List[str]) -> int:
            name = find(event_names, patterns)
            return counts.get(name, 0) if name else 0

        def rate(num: float, den: float) -> float:
            return round((num / max(1, den)) * 100, 2)

        kyc_started = total_for([r"kyc.*start", r"start.*kyc", r"kyc_initiated"])
        kyc_submitted = total_for([r"kyc.*submit", r"submit.*kyc", r"kyc.*upload"])
        kyc_approved = total_for([r"kyc.*approv", r"kyc.*pass", r"kyc.*success", r"kyc.*complete"])

        kyb_started = total_for([r"kyb.*start", r"start.*kyb", r"kyb_initiated"])
        kyb_approved = total_for([r"kyb.*approv", r"kyb.*pass", r"kyb.*success", r"kyb.*complete"])

        payment_initiated = total_for([r"payment.*init", r"pay.*initiated", r"payment.*start", r"transaction.*init"])
        payment_succeeded = total_for([r"payment.*success", r"payment.*completed", r"payment.*approved", r"transaction.*success"])
        payment_failed = total_for([r"payment.*fail", r"payment.*declined", r"payment.*error", r"transaction.*fail"])

        matched = {
            "kyc_started": kyc_started > 0,
            "kyc_approved": kyc_approved > 0,
            "payment_succeeded": payment_succeeded > 0,
        }

        metrics.append({
            "source": "mixpanel",
            "metric_type": "kyc_pass_rate",
            "entity": "mixpanel",
            "value": rate(kyc_approved, kyc_started),
            "meta": {
                "started": kyc_started,
                "submitted": kyc_submitted,
                "approved": kyc_approved,
                "submitted_rate": rate(kyc_submitted, kyc_started),
            },
            "timestamp": now,
        })

        metrics.append({
            "source": "mixpanel",
            "metric_type": "kyb_pass_rate",
            "entity": "mixpanel",
            "value": rate(kyb_approved, kyb_started),
            "meta": {
                "started": kyb_started,
                "approved": kyb_approved,
            },
            "timestamp": now,
        })

        metrics.append({
            "source": "mixpanel",
            "metric_type": "payment_success_rate",
            "entity": "mixpanel",
            "value": rate(payment_succeeded, payment_initiated),
            "meta": {
                "initiated": payment_initiated,
                "succeeded": payment_succeeded,
                "failed": payment_failed,
            },
            "timestamp": now,
        })

        metrics.append({
            "source": "mixpanel",
            "metric_type": "transaction_volume",
            "entity": "mixpanel",
            "value": float(payment_succeeded),
            "meta": {"basis": "successful_payment_events"},
            "timestamp": now,
        })

        metrics.append({
            "source": "mixpanel",
            "metric_type": "configured_provider",
            "entity": "mixpanel",
            "value": 1,
            "value_text": self.project_id or "mixpanel",
            "meta": {"event_count": len(event_names), **matched},
            "timestamp": now,
        })

        return metrics

    async def fetch_events(self) -> List[Dict[str, Any]]:
        return []

    async def list_event_names(self) -> List[str]:
        """Return event names from the Mixpanel project."""
        if not self.api_secret and not self.api_key:
            return []
        async with httpx.AsyncClient() as client:
            try:
                r = await client.get(
                    "https://mixpanel.com/api/2.0/events/names",
                    params={"type": "general", "limit": 255},
                    auth=self._auth(),
                    timeout=15,
                )
                if r.status_code != 200:
                    return []
                data = r.json()
                if isinstance(data, list):
                    return [str(name) for name in data if name]
                return []
            except Exception:
                return []

    async def _fetch_event_counts(self, event_names: List[str]) -> Dict[str, int]:
        if not event_names or (not self.api_secret and not self.api_key):
            return {}

        async with httpx.AsyncClient() as client:
            params: Dict[str, Any] = {
                "event": event_names,
                "type": "general",
                "unit": "week",
                "interval": 1,
                "from_date": (dt.datetime.utcnow() - dt.timedelta(days=7)).strftime("%Y-%m-%d"),
                "to_date": dt.datetime.utcnow().strftime("%Y-%m-%d"),
                "on": "properties['time']",
                "limit": 255,
            }
            try:
                r = await client.get(
                    "https://mixpanel.com/api/2.0/events/properties",
                    params=params,
                    auth=self._auth(),
                    timeout=20,
                )
                if r.status_code != 200:
                    return {}
                data = r.json()
                series = data.get("data", {}).get("values", {})
                result: Dict[str, int] = {}
                for event_name, daily_values in series.items():
                    total = sum(int(v) for v in daily_values.values() if isinstance(v, (int, float, str)))
                    result[event_name] = total
                return result
            except Exception:
                return {}
