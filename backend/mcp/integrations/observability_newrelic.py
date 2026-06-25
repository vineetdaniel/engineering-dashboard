"""New Relic-specific helpers for the observability connector.

Uses NerdGraph GraphQL to query APM metrics and AI incidents and normalizes them
into the Metric/Event dictionaries expected by the rest of the backend.
"""

import datetime as dt
from typing import Any, Dict, List

import httpx


NERDGRAPH_URL = "https://api.newrelic.com/graphql"


def _services(config: Dict[str, Any]) -> List[str]:
    raw = config.get("NR_SERVICES", "")
    return [s.strip() for s in str(raw).split(",") if s.strip()]


def _environment(config: Dict[str, Any]) -> str:
    return str(config.get("NR_ENVIRONMENT", "prod")).strip() or "prod"


def _now() -> dt.datetime:
    return dt.datetime.utcnow()


def _headers(api_key: str) -> Dict[str, str]:
    return {"API-Key": api_key, "Content-Type": "application/json"}


async def _run_nrql(
    client: httpx.AsyncClient,
    api_key: str,
    account_id: str,
    query: str,
) -> List[Dict[str, Any]]:
    """Run an NRQL query via NerdGraph and return the result rows."""
    gql = """
    query ($accountId: Int!, $query: Nrql!) {
      actor {
        account(id: $accountId) {
          nrql(query: $query) {
            results
          }
        }
      }
    }
    """
    payload = {
        "query": gql,
        "variables": {"accountId": int(account_id), "query": query},
    }
    r = await client.post(NERDGRAPH_URL, json=payload)
    r.raise_for_status()
    data = r.json()
    if data.get("errors"):
        raise RuntimeError(f"NerdGraph errors: {data['errors']}")
    return data["data"]["actor"]["account"]["nrql"]["results"] or []


def _format_query(template: str, service: str, environment: str) -> str:
    placeholders = template.count("%s")
    if placeholders == 0:
        return template
    values = [service, environment] * ((placeholders // 2) + 1)
    return template % tuple(values[:placeholders])


async def fetch_newrelic_metrics(
    client: httpx.AsyncClient,
    config: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Fetch New Relic APM metrics for configured services."""
    api_key = config.get("NR_API_KEY", "")
    account_id = config.get("NR_ACCOUNT_ID", "")
    services = _services(config)
    environment = _environment(config)

    if not api_key or not account_id or not services:
        return []

    # Default NRQL templates. Users can override via ConnectorConfig.
    default_uptime_query = (
        "SELECT percentage(count(*), WHERE error IS false) "
        "FROM Transaction WHERE appName = '%s' AND environment = '%s' "
        "SINCE 24 hours ago TIMESERIES 1 hour"
    )
    default_latency_query = (
        "SELECT percentile(duration, 95) FROM Transaction "
        "WHERE appName = '%s' AND environment = '%s' "
        "SINCE 24 hours ago TIMESERIES 1 hour"
    )
    default_p99_query = (
        "SELECT percentile(duration, 99) FROM Transaction "
        "WHERE appName = '%s' AND environment = '%s' "
        "SINCE 24 hours ago TIMESERIES 1 hour"
    )
    default_error_query = (
        "SELECT percentage(count(*), WHERE error IS true) "
        "FROM Transaction WHERE appName = '%s' AND environment = '%s' "
        "SINCE 24 hours ago TIMESERIES 1 hour"
    )

    default_tx_volume_query = (
        "SELECT count(*) FROM Transaction WHERE appName = '%s' AND environment = '%s' SINCE 24 hours ago"
    )

    query_specs = [
        ("uptime_pct", config.get("NR_UPTIME_QUERY") or default_uptime_query),
        ("p95_latency_ms", config.get("NR_LATENCY_QUERY") or default_latency_query),
        ("latency_p99", config.get("NR_P99_LATENCY_QUERY") or default_p99_query),
        ("error_rate_pct", config.get("NR_ERROR_RATE_QUERY") or default_error_query),
        ("transaction_volume", config.get("NR_TRANSACTION_VOLUME_QUERY") or default_tx_volume_query),
    ]

    all_metrics: List[Dict[str, Any]] = []
    for service in services:
        for metric_type, template in query_specs:
            query = _format_query(template, service, environment)
            try:
                rows = await _run_nrql(client, api_key, account_id, query)
                for row in rows:
                    ts = row.get("beginTimeSeconds") or row.get("timestamp")
                    if not ts:
                        continue
                    value = row.get("percentage.count...error IS false") or row.get("percentile.duration...95") or row.get("percentile.duration...99") or row.get("percentage.count...error IS true")
                    if value is None:
                        # New Relic column names vary; try common keys.
                        for key in ("result", "value", "count", "average", "percentage"):
                            if key in row:
                                value = row[key]
                                break
                    if value is None:
                        continue
                    timestamp = dt.datetime.utcfromtimestamp(ts)
                    all_metrics.append({
                        "source": "newrelic",
                        "metric_type": metric_type,
                        "entity": service,
                        "value": float(value),
                        "meta": {
                            "service": service,
                            "environment": environment,
                            "query": query,
                        },
                        "timestamp": timestamp.isoformat(),
                    })
            except Exception:
                all_metrics.append({
                    "source": "newrelic",
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


def _severity_from_priority(priority: str) -> str:
    mapping = {"critical": "critical", "high": "high", "warning": "medium", "info": "low"}
    return mapping.get(str(priority).lower(), "medium")


async def fetch_newrelic_events(
    client: httpx.AsyncClient,
    config: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Fetch New Relic AI incidents and map them to dashboard events."""
    api_key = config.get("NR_API_KEY", "")
    account_id = config.get("NR_ACCOUNT_ID", "")
    services = _services(config)
    environment = _environment(config)

    if not api_key or not account_id:
        return []

    service_filter = " OR ".join(f"entityName LIKE '%{s}%'" for s in services) if services else "true"
    query = (
        f"SELECT incidentId, title, priority, state, entityName "
        f"FROM NrAiIncident WHERE {service_filter} "
        f"SINCE 24 hours ago LIMIT 100"
    )

    try:
        rows = await _run_nrql(client, api_key, account_id, query)
    except Exception:
        return []

    events: List[Dict[str, Any]] = []
    now = _now().isoformat()
    for row in rows:
        state = str(row.get("state", "")).lower()
        if state in ("closed", "resolved"):
            status = "resolved"
        else:
            status = "open"

        title = row.get("title") or "New Relic incident"
        priority = row.get("priority", "medium")
        entity = row.get("entityName") or "unknown"
        incident_id = row.get("incidentId")

        # Treat latency/error condition titles as SLO breaches.
        title_lower = str(title).lower()
        if "latency" in title_lower or "error" in title_lower or "apdex" in title_lower:
            event_type = "slo_breach"
        else:
            event_type = "incident"

        events.append({
            "source": "newrelic",
            "event_type": event_type,
            "entity": entity,
            "title": title,
            "severity": _severity_from_priority(priority),
            "status": status,
            "meta": {
                "incident_id": incident_id,
                "service": entity,
                "environment": environment,
                "permalink": f"https://one.newrelic.com/launcher/nrai.incidents?pane=eyJpbmNpZGVudElkIjoie1pbmNpZGVudElkXX0" if incident_id else None,
            },
            "happened_at": now,
        })

    return events


async def newrelic_health_check(config: Dict[str, Any]) -> Dict[str, Any]:
    """Validate that New Relic credentials can run NRQL."""
    api_key = config.get("NR_API_KEY", "")
    account_id = config.get("NR_ACCOUNT_ID", "")

    if not api_key or not account_id:
        return {"ok": False, "error": "NR_API_KEY and NR_ACCOUNT_ID required"}

    services = _services(config)
    if not services:
        return {"ok": False, "error": "No services configured. Set NR_SERVICES."}

    async with httpx.AsyncClient(headers=_headers(api_key)) as client:
        try:
            query = "SELECT count(*) FROM Transaction SINCE 1 hour ago"
            rows = await _run_nrql(client, api_key, account_id, query)
            return {"ok": True, "error": None, "row_count": len(rows)}
        except httpx.HTTPStatusError as exc:
            return {"ok": False, "error": f"New Relic API error: {exc.response.status_code} {exc.response.text}"}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}
