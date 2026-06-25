"""AWS Cost Explorer connector for cloud spend and budget signals."""

import datetime as dt
from decimal import Decimal
from typing import Any, Dict, List, Optional

import httpx

from backend.mcp.integrations.base import Connector


class AWSCostConnector(Connector):
    name = "aws_cost"
    required_env = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]

    def __init__(self, config: Dict[str, Any] | None = None):
        cfg = config or {}
        self.access_key = cfg.get("AWS_ACCESS_KEY_ID", "")
        self.secret_key = cfg.get("AWS_SECRET_ACCESS_KEY", "")
        self.session_token = cfg.get("AWS_SESSION_TOKEN", "") or cfg.get("AWS_SECURITY_TOKEN", "")
        self.region = cfg.get("AWS_REGION", "us-east-1") or "us-east-1"
        self.timeout = 30.0
        self.services = [
            s.strip()
            for s in (cfg.get("AWS_SERVICES", "") or "").split(",")
            if s.strip()
        ] or ["EC2", "S3", "RDS", "Data Transfer", "Lambda"]
        self.monthly_budget_override = _parse_float(cfg.get("AWS_MONTHLY_BUDGET", ""))
        self.delta_threshold_pct = _parse_float(cfg.get("AWS_COST_DELTA_THRESHOLD_PCT", "25"), default=25.0)
        self.critical_risk_threshold_pct = _parse_float(cfg.get("AWS_COST_CRITICAL_RISK_THRESHOLD_PCT", "50"), default=50.0)
        self.top_drivers_count = _parse_int(cfg.get("AWS_COST_TOP_DRIVERS_COUNT", "5"), default=5)

    def _headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "AWSInsightsIndexService.GetCostAndUsage",
        }
        if self.session_token:
            headers["X-Amz-Security-Token"] = self.session_token
        return headers

    def _sigv4_headers(
        self,
        method: str,
        uri: str,
        payload: str,
        service: str = "ce",
        host: Optional[str] = None,
    ) -> Dict[str, str]:
        import hashlib
        import hmac

        now = dt.datetime.utcnow()
        amz_date = now.strftime("%Y%m%dT%H%M%SZ")
        date_stamp = now.strftime("%Y%m%d")
        host = host or f"ce.{self.region}.amazonaws.com"
        canonical_uri = uri
        canonical_querystring = ""
        payload_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        canonical_headers = f"content-type:application/x-amz-json-1.1\nhost:{host}\nx-amz-date:{amz_date}\n"
        signed_headers = "content-type;host;x-amz-date"
        if self.session_token:
            canonical_headers += f"x-amz-security-token:{self.session_token}\n"
            signed_headers += ";x-amz-security-token"
        canonical_request = (
            f"{method}\n{canonical_uri}\n{canonical_querystring}\n{canonical_headers}\n"
            f"{signed_headers}\n{payload_hash}"
        )
        credential_scope = f"{date_stamp}/{self.region}/{service}/aws4_request"
        string_to_sign = (
            f"AWS4-HMAC-SHA256\n{amz_date}\n{credential_scope}\n"
            f"{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"
        )
        k_date = hmac.new(
            f"AWS4{self.secret_key}".encode("utf-8"), date_stamp.encode("utf-8"), hashlib.sha256
        ).digest()
        k_region = hmac.new(k_date, self.region.encode("utf-8"), hashlib.sha256).digest()
        k_service = hmac.new(k_region, service.encode("utf-8"), hashlib.sha256).digest()
        k_signing = hmac.new(k_service, "aws4_request".encode("utf-8"), hashlib.sha256).digest()
        signature = hmac.new(k_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
        auth_header = (
            f"AWS4-HMAC-SHA256 Credential={self.access_key}/{credential_scope}, "
            f"SignedHeaders={signed_headers}, Signature={signature}"
        )
        headers = self._headers()
        headers["Host"] = host
        headers["X-Amz-Date"] = amz_date
        headers["Authorization"] = auth_header
        return headers

    async def health_check(self) -> Dict[str, Any]:
        if not self.access_key or not self.secret_key:
            return {"ok": False, "error": "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY required"}
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await self._ce_post(client, self._mtd_payload())
                if r.status_code == 200:
                    return {"ok": True, "error": None, "sample_results": len(r.json().get("ResultsByTime", []))}
                return {"ok": False, "error": f"HTTP {r.status_code}: {r.text[:200]}"}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    async def fetch_metrics(self) -> List[Dict[str, Any]]:
        now = dt.datetime.utcnow()
        start_of_month = now.replace(day=1).date()
        day_of_month = max(1, now.day)
        days_in_month = _days_in_month(now.year, now.month)
        metrics: List[Dict[str, Any]] = []
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await self._ce_post(client, self._mtd_payload())
            r.raise_for_status()
            data = r.json()
            total = sum(_period_total(day) for day in data.get("ResultsByTime", []))
            metrics.append({
                "source": "aws_cost",
                "metric_type": "cloud_spend_mtd",
                "entity": "aws",
                "value": round(total, 2),
                "meta": {"currency": "USD", "period": str(start_of_month)},
                "timestamp": now.isoformat(),
            })

            # Build a conservative budget estimate: 110% of last full month spend.
            # If last month is empty (new account / no spend), fall back to a projection from MTD.
            last_month_start = (start_of_month - dt.timedelta(days=1)).replace(day=1)
            last_month_end = start_of_month - dt.timedelta(days=1)
            budget_r = await self._ce_post(
                client,
                {
                    "TimePeriod": {
                        "Start": str(last_month_start),
                        "End": str(last_month_end),
                    },
                    "Granularity": "MONTHLY",
                    "Metrics": ["UnblendedCost"],
                },
            )
            budget_r.raise_for_status()
            last_month_total = sum(_period_total(day) for day in budget_r.json().get("ResultsByTime", []))
            if self.monthly_budget_override and self.monthly_budget_override > 0:
                monthly_budget = round(self.monthly_budget_override, 2)
                budget_basis = "override"
            else:
                projected_mtd_to_month = (total / day_of_month) * days_in_month if day_of_month > 0 else total
                monthly_budget = round((last_month_total * 1.1) if last_month_total > 0 else projected_mtd_to_month, 2)
                budget_basis = "last_month_plus_10pct"
            metrics.append({
                "source": "aws_cost",
                "metric_type": "monthly_budget",
                "entity": "aws",
                "value": monthly_budget,
                "meta": {"basis": budget_basis},
                "timestamp": now.isoformat(),
            })
            if monthly_budget > 0:
                metrics.append({
                    "source": "aws_cost",
                    "metric_type": "budget_used_pct",
                    "entity": "aws",
                    "value": round((total / monthly_budget) * 100, 2),
                    "meta": {"mtd": total, "budget": monthly_budget},
                    "timestamp": now.isoformat(),
                })

            # Trailing 12 months of monthly spend for historical trend charts.
            history_start = (start_of_month - dt.timedelta(days=365)).replace(day=1)
            history_r = await self._ce_post(
                client,
                {
                    "TimePeriod": {"Start": str(history_start), "End": str(now.date())},
                    "Granularity": "MONTHLY",
                    "Metrics": ["UnblendedCost"],
                },
            )
            history_r.raise_for_status()
            for month in history_r.json().get("ResultsByTime", []):
                month_total = _period_total(month)
                period = month.get("TimePeriod", {}).get("Start", "")
                if period and month_total >= 0:
                    metrics.append({
                        "source": "aws_cost",
                        "metric_type": "monthly_spend",
                        "entity": "aws",
                        "value": round(month_total, 2),
                        "meta": {"currency": "USD", "period": period},
                        "timestamp": now.isoformat(),
                    })

            # Cost per service for top drivers and savings opportunities.
            by_service = await self._cost_by_service(client)
            top_services = sorted(by_service.items(), key=lambda x: x[1], reverse=True)[: self.top_drivers_count]
            total_spend = sum(by_service.values())
            for service, amount in top_services:
                metrics.append({
                    "source": "aws_cost",
                    "metric_type": "cost_driver",
                    "entity": service,
                    "value": round(amount, 2),
                    "meta": {"pct_of_total": round((amount / max(1, total_spend)) * 100, 2)},
                    "timestamp": now.isoformat(),
                })

            # Heuristic savings opportunities: any non-compute service over 10% of spend.
            savings = sum(
                amount for service, amount in by_service.items()
                if service not in ("EC2", "RDS", "EKS") and amount > total_spend * 0.1
            )
            metrics.append({
                "source": "aws_cost",
                "metric_type": "savings_opportunities",
                "entity": "aws",
                "value": round(savings, 2),
                "meta": {"services": [s for s, a in by_service.items() if a > total_spend * 0.1 and s not in ("EC2", "RDS", "EKS")]},
                "timestamp": now.isoformat(),
            })
        return metrics

    async def fetch_events(self) -> List[Dict[str, Any]]:
        # Emit cost events for any service whose month-over-month delta is > 25%.
        now = dt.datetime.utcnow()
        this_month_start = now.replace(day=1).date()
        last_month_start = (this_month_start - dt.timedelta(days=1)).replace(day=1)
        last_month_end = this_month_start - dt.timedelta(days=1)
        events: List[Dict[str, Any]] = []
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            current = await self._cost_by_service(client, str(this_month_start), str(now.date()))
            previous = await self._cost_by_service(client, str(last_month_start), str(last_month_end))
        threshold = self.delta_threshold_pct / 100.0
        critical_threshold = self.critical_risk_threshold_pct / 100.0
        for service, amount in current.items():
            prev = previous.get(service, 0)
            if prev > 0:
                delta = (amount - prev) / prev
                if delta > threshold:
                    events.append({
                        "source": "aws_cost",
                        "event_type": "cost_driver",
                        "entity": service,
                        "title": f"{service} spend increased {delta*100:.0f}% vs last month",
                        "severity": "critical" if delta > critical_threshold else "high",
                        "status": "open",
                        "meta": {"current": round(amount, 2), "previous": round(prev, 2), "delta_pct": round(delta * 100, 1)},
                        "happened_at": now.isoformat(),
                    })
        return events

    def _mtd_payload(self) -> Dict[str, Any]:
        now = dt.datetime.utcnow()
        start = now.replace(day=1).date()
        return {
            "TimePeriod": {"Start": str(start), "End": str(now.date())},
            "Granularity": "DAILY",
            "Metrics": ["UnblendedCost"],
            "GroupBy": [{"Type": "DIMENSION", "Key": "SERVICE"}],
        }

    async def _ce_post(self, client: httpx.AsyncClient, payload: Dict[str, Any]) -> httpx.Response:
        body = _json_dump(payload)
        host = f"ce.{self.region}.amazonaws.com"
        headers = self._sigv4_headers("POST", "/", body, host=host)
        return await client.post(
            f"https://{host}/",
            headers=headers,
            content=body,
        )

    async def _cost_by_service(
        self,
        client: httpx.AsyncClient,
        start: Optional[str] = None,
        end: Optional[str] = None,
    ) -> Dict[str, float]:
        now = dt.datetime.utcnow()
        start = start or str(now.replace(day=1).date())
        end = end or str(now.date())
        r = await self._ce_post(
            client,
            {
                "TimePeriod": {"Start": start, "End": end},
                "Granularity": "MONTHLY",
                "Metrics": ["UnblendedCost"],
                "GroupBy": [{"Type": "DIMENSION", "Key": "SERVICE"}],
            },
        )
        r.raise_for_status()
        by_service: Dict[str, float] = {}
        for day in r.json().get("ResultsByTime", []):
            for g in day.get("Groups", []):
                service = g.get("Keys", ["Unknown"])[0]
                amount = _to_float(g.get("Metrics", {}).get("UnblendedCost", {}).get("Amount", 0))
                by_service[service] = by_service.get(service, 0) + amount
        return by_service


def _to_float(value: Any) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except Exception:
        return 0.0


def _parse_float(value: Any, default: float = 0.0) -> float | None:
    if value is None or (isinstance(value, str) and not value.strip()):
        return None if default == 0.0 else default
    try:
        return float(value)
    except Exception:
        return default


def _parse_int(value: Any, default: int = 0) -> int:
    if value is None or (isinstance(value, str) and not value.strip()):
        return default
    try:
        return int(float(value))
    except Exception:
        return default


def _period_total(period: Dict[str, Any]) -> float:
    """Return UnblendedCost total for a ResultsByTime entry.

    Works for grouped responses (Groups present), ungrouped responses where
    totals live under `Total`, and older responses that used `Metrics`.
    """
    groups = period.get("Groups") or []
    if groups:
        return sum(
            _to_float(g.get("Metrics", {}).get("UnblendedCost", {}).get("Amount", 0))
            for g in groups
        )
    # Ungrouped responses put the total under `Total`; some legacy shapes use `Metrics`.
    total = period.get("Total", {})
    if total:
        return _to_float(total.get("UnblendedCost", {}).get("Amount", 0))
    return _to_float(period.get("Metrics", {}).get("UnblendedCost", {}).get("Amount", 0))


def _days_in_month(year: int, month: int) -> int:
    if month == 12:
        next_month = dt.date(year + 1, 1, 1)
    else:
        next_month = dt.date(year, month + 1, 1)
    return (next_month - dt.date(year, month, 1)).days


def _json_dump(obj: Any) -> str:
    import json

    def _default(o: Any) -> Any:
        if isinstance(o, Decimal):
            return str(o)
        raise TypeError(f"Object of type {type(o)} is not JSON serializable")

    return json.dumps(obj, default=_default)
