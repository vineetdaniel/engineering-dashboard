"""Datadog-specific helpers for the observability connector.

These functions query Datadog metrics and monitors and normalize the responses
into the Metric/Event dictionaries expected by the rest of the backend.
"""

import datetime as dt
from typing import Any, Dict, List

import httpx


def _base_headers(api_key: str, app_key: str) -> Dict[str, str]:
    return {
        "DD-API-KEY": api_key,
        "DD-APPLICATION-KEY": app_key,
        "Accept": "application/json",
    }


def _services(config: Dict[str, Any]) -> List[str]:
    raw = config.get("DD_SERVICES", "")
    return [s.strip() for s in str(raw).split(",") if s.strip()]


def _environment(config: Dict[str, Any]) -> str:
    return str(config.get("DD_ENVIRONMENT", "prod")).strip() or "prod"


def _query_url(site: str) -> str:
    return f"https://api.{site}/api/v1/query"


def _monitor_url(site: str) -> str:
    return f"https://api.{site}/api/v1/monitor"


def _now() -> dt.datetime:
    return dt.datetime.utcnow()


def _time_window(hours: int = 24) -> tuple[int, int]:
    """Return (from_epoch, to_epoch) for the last N hours."""
    to_dt = _now()
    from_dt = to_dt - dt.timedelta(hours=hours)
    return int(from_dt.timestamp()), int(to_dt.timestamp())


async def _run_query(
    client: httpx.AsyncClient,
    site: str,
    query: str,
    from_ts: int,
    to_ts: int,
) -> List[Dict[str, Any]]:
    """Run a Datadog v1 metric query and return the series list."""
    url = _query_url(site)
    params = {"query": query, "from": from_ts, "to": to_ts}
    r = await client.get(url, params=params)
    r.raise_for_status()
    return r.json().get("series", [])


def _series_to_metrics(
    series: List[Dict[str, Any]],
    metric_type: str,
    service: str,
    environment: str,
    query: str,
) -> List[Dict[str, Any]]:
    """Convert Datadog series pointlists into CTO Dash Metric rows."""
    metrics: List[Dict[str, Any]] = []
    now = _now().isoformat()
    for s in series:
        scope = s.get("scope", "")
        tag_set = s.get("tag_set", [])
        pointlist = s.get("pointlist", [])
        interval = s.get("interval", 0)
        for point in pointlist:
            if not point or len(point) < 2:
                continue
            ts_ms, value = point
            if value is None:
                continue
            ts = dt.datetime.utcfromtimestamp(ts_ms / 1000.0)
            metrics.append({
                "source": "datadog",
                "metric_type": metric_type,
                "entity": service,
                "value": float(value),
                "meta": {
                    "service": service,
                    "environment": environment,
                    "query": query,
                    "scope": scope,
                    "tag_set": tag_set,
                    "interval": interval,
                },
                "timestamp": ts.isoformat(),
            })
    return metrics


def _format_query(template: str, service: str, environment: str) -> str:
    """Fill service/environment placeholders into a query template.

    Supports %s positional placeholders. Values are cycled service, env, service,
    env... so arithmetic queries like "A{service,env} / B{service,env}" work.

    The values are escaped so they can only contain metric-tag-safe characters
    (alphanumeric, hyphen, underscore, period, colon, slash, and space). This
    prevents query-injection via crafted connector config values.
    """
    _SAFE = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.:/ ")

    def _escape(value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("service/environment value must be non-empty")
        if any(ch not in _SAFE for ch in cleaned):
            raise ValueError(
                f"service/environment value contains unsafe characters: {value!r}"
            )
        return cleaned

    placeholders = template.count("%s")
    if placeholders == 0:
        return template
    values = [_escape(service), _escape(environment)] * ((placeholders // 2) + 1)
    return template % tuple(values[:placeholders])


async def fetch_datadog_metrics(
    client: httpx.AsyncClient,
    config: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Fetch all configured Datadog metrics for all configured services."""
    api_key = config.get("DD_API_KEY", "")
    app_key = config.get("DD_APP_KEY", "")
    site = config.get("DD_SITE", "datadoghq.com")
    services = _services(config)
    environment = _environment(config)

    if not api_key or not app_key or not services:
        return []

    from_ts, to_ts = _time_window(hours=24)

    # Map config key -> (metric_type, query_template_key)
    query_specs = [
        ("uptime_pct", "DD_UPTIME_QUERY"),
        ("p95_latency_ms", "DD_LATENCY_QUERY"),
        ("latency_p99", "DD_P99_LATENCY_QUERY"),
        ("error_rate_pct", "DD_ERROR_RATE_QUERY"),
        ("transaction_volume", "DD_TRANSACTION_VOLUME_QUERY"),
    ]

    all_metrics: List[Dict[str, Any]] = []
    for service in services:
        for metric_type, template_key in query_specs:
            template = config.get(template_key, "")
            if not template:
                continue
            query = _format_query(template, service, environment)
            try:
                series = await _run_query(client, site, query, from_ts, to_ts)
                metrics = _series_to_metrics(series, metric_type, service, environment, query)
                all_metrics.extend(metrics)
            except Exception:
                # Emit a placeholder metric so the gap is visible in the UI.
                all_metrics.append({
                    "source": "datadog",
                    "metric_type": metric_type,
                    "entity": service,
                    "value": 0.0,
                    "meta": {
                        "service": service,
                        "environment": environment,
                        "query": query,
                        "error": "query failed",
                    },
                    "timestamp": _now().isoformat(),
                })

    return all_metrics


def _monitor_severity(priority: Any) -> str:
    """Map Datadog priority to dashboard severity."""
    mapping = {1: "critical", 2: "critical", 3: "high", 4: "medium", 5: "low"}
    return mapping.get(priority, "medium")


def _monitor_status(overall_state: str) -> str:
    """Map Datadog overall_state to dashboard incident status."""
    return "open" if overall_state in ("Alert", "No Data", "Warn") else "resolved"


async def fetch_datadog_events(
    client: httpx.AsyncClient,
    config: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Fetch Datadog monitors and map triggered ones to dashboard events."""
    api_key = config.get("DD_API_KEY", "")
    app_key = config.get("DD_APP_KEY", "")
    site = config.get("DD_SITE", "datadoghq.com")
    services = _services(config)
    environment = _environment(config)

    if not api_key or not app_key:
        return []

    url = _monitor_url(site)
    params: Dict[str, Any] = {"group_states": "all"}
    if services:
        params["tags"] = f"env:{environment}"

    r = await client.get(url, params=params)
    r.raise_for_status()
    monitors = r.json()

    events: List[Dict[str, Any]] = []
    now = _now().isoformat()
    for monitor in monitors:
        state = monitor.get("overall_state", "")
        if state not in ("Alert", "Warn", "No Data"):
            continue

        tags = monitor.get("tags", [])
        name = monitor.get("name", "Unknown monitor")
        monitor_id = monitor.get("id")
        priority = monitor.get("priority")

        # Determine event type from tags.
        tag_str = ",".join(str(t) for t in tags).lower()
        if "slo" in tag_str or "latency" in tag_str or "error_rate" in tag_str:
            event_type = "slo_breach"
        else:
            event_type = "incident"

        service = next((str(t).split(":", 1)[1] for t in tags if str(t).startswith("service:")), "unknown")

        events.append({
            "source": "datadog",
            "event_type": event_type,
            "entity": service,
            "title": name,
            "severity": _monitor_severity(priority),
            "status": _monitor_status(state),
            "meta": {
                "monitor_id": monitor_id,
                "service": service,
                "environment": environment,
                "tags": tags,
                "permalink": f"https://app.{site}/monitors/{monitor_id}",
            },
            "happened_at": now,
        })

    return events


async def datadog_health_check(config: Dict[str, Any]) -> Dict[str, Any]:
    """Validate that Datadog credentials can query metrics."""
    api_key = config.get("DD_API_KEY", "")
    app_key = config.get("DD_APP_KEY", "")
    site = config.get("DD_SITE", "datadoghq.com")

    if not api_key or not app_key:
        return {"ok": False, "error": "DD_API_KEY and DD_APP_KEY required"}

    services = _services(config)
    if not services:
        return {"ok": False, "error": "No services configured. Set DD_SERVICES."}

    environment = _environment(config)
    first_service = services[0]
    template = config.get("DD_LATENCY_QUERY", "")
    if not template:
        return {"ok": False, "error": "DD_LATENCY_QUERY not configured"}

    query = _format_query(template, first_service, environment)
    from_ts, to_ts = _time_window(hours=1)

    async with httpx.AsyncClient(headers=_base_headers(api_key, app_key)) as client:
        try:
            series = await _run_query(client, site, query, from_ts, to_ts)
            return {"ok": True, "error": None, "series_count": len(series)}
        except httpx.HTTPStatusError as exc:
            return {"ok": False, "error": f"Datadog API error: {exc.response.status_code} {exc.response.text}"}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}
