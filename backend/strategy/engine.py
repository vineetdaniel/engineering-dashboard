"""Strategy engine: derive CTO-level strategy from goals + accumulated data.

The engine always produces rule-based action items. If OPENAI_API_KEY is
configured, it also asks an LLM to write a seasoned-CTO narrative that blends
the user's stated goals with the current data signals.
"""

import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.config import settings


def _pick(metrics: List[Dict[str, Any]], metric_type: str) -> Optional[Dict[str, Any]]:
    """Return the most recent metric of the given type."""
    matches = [m for m in metrics if m.get("metric_type") == metric_type]
    if not matches:
        return None
    matches.sort(key=lambda m: m.get("timestamp") or "", reverse=True)
    return matches[0]


def _sum_recent(metrics: List[Dict[str, Any]], metric_type: str) -> float:
    return sum(float(m.get("value") or 0) for m in metrics if m.get("metric_type") == metric_type)


def _count(events: List[Dict[str, Any]], event_type: str) -> int:
    return len([e for e in events if e.get("event_type") == event_type])


def _active(events: List[Dict[str, Any]], event_type: str) -> List[Dict[str, Any]]:
    return [e for e in events if e.get("event_type") == event_type and e.get("status") != "resolved"]


def _extract_text(goals: Dict[str, str], key: str) -> str:
    return (goals.get(key) or "").strip()


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def _action(
    title: str,
    rationale: str,
    section: str,
    priority: str = "medium",
    owner: Optional[str] = None,
    due_hint: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "id": f"{section}-{_now_iso()}-{title}".replace(" ", "_").lower()[:64],
        "title": title,
        "rationale": rationale,
        "section": section,
        "priority": priority,
        "owner": owner,
        "due_hint": due_hint,
    }


def _clamp(value: float, low: float = 0, high: float = 100) -> float:
    return max(low, min(high, value))


GOAL_CARD_TEMPLATES: List[Dict[str, Any]] = [
    {
        "goal_key": "six_month",
        "title": "6-month strategic aim",
        "target": "Define and hit a clear 6-month business outcome",
        "metric_type": "uptime_pct",
        "direction": "up",
        "threshold": 99.99,
        "section": "strategy",
        "weight": 0.20,
    },
    {
        "goal_key": "quarterly",
        "title": "Quarterly focus",
        "target": "Ship quarterly bets with high quality",
        "metric_type": "change_failure_rate",
        "direction": "down",
        "threshold": 10.0,
        "section": "engineering",
        "weight": 0.20,
    },
    {
        "goal_key": "weekly",
        "title": "Weekly commitment",
        "target": "Close blockers and maintain flow",
        "metric_type": "open_prs",
        "direction": "down",
        "threshold": 20.0,
        "section": "engineering",
        "weight": 0.20,
    },
    {
        "goal_key": "ai_strategy_focus",
        "title": "AI strategy focus",
        "target": "Progress AI bets safely",
        "metric_type": "payment_success_rate",
        "direction": "up",
        "threshold": 99.9,
        "section": "strategy",
        "weight": 0.20,
    },
    {
        "goal_key": "top_risks",
        "title": "Top risks mitigated",
        "target": "Reduce exposure on stated risks",
        "metric_type": "compliance_control_status",
        "direction": "up",
        "threshold": 1.0,
        "section": "security",
        "weight": 0.10,
    },
    {
        "goal_key": "growth_levers",
        "title": "Growth levers",
        "target": "Grow revenue-critical metrics",
        "metric_type": "fraud_rate",
        "direction": "down",
        "threshold": 0.5,
        "section": "payments",
        "weight": 0.10,
    },
]


def _compute_goal_cards(
    goals: Dict[str, str],
    metrics: List[Dict[str, Any]],
    events: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Build a measurable card for each strategic aim.

    Each card binds an aim to a proxy metric from the data, computes current
    progress vs target, and assigns an RAG status and owner hint.
    """
    cards: List[Dict[str, Any]] = []

    for template in GOAL_CARD_TEMPLATES:
        aim = _extract_text(goals, template["goal_key"])
        if not aim:
            continue

        metric = _pick(metrics, template["metric_type"])
        raw_value = metric.get("value") if metric else None
        direction = template["direction"]
        threshold = template["threshold"]

        if raw_value is None:
            progress = None
            status = "unknown"
            current = None
        else:
            current = float(raw_value)
            if direction == "up":
                progress = _clamp((current / threshold) * 100)
                status = "on_track" if current >= threshold else "at_risk" if current >= threshold * 0.8 else "behind"
            else:
                # down metric: 0 is 100% progress, threshold is 0% progress
                if current <= 0:
                    progress = 100.0
                elif current >= threshold:
                    progress = 0.0
                else:
                    progress = _clamp((1 - (current / threshold)) * 100)
                status = "on_track" if current <= threshold else "at_risk" if current <= threshold * 1.25 else "behind"

        cards.append({
            "id": f"goal-{template['goal_key']}",
            "goal_key": template["goal_key"],
            "title": template["title"],
            "aim": aim,
            "metric_type": template["metric_type"],
            "metric_label": _METRIC_LABELS.get(template["metric_type"], template["metric_type"]),
            "target": template["target"],
            "target_value": threshold,
            "direction": direction,
            "current": round(current, 3) if current is not None else None,
            "progress": round(progress, 1) if progress is not None else None,
            "status": status,
            "section": template["section"],
            "owner": "CTO",
            "weight": template["weight"],
        })

    return cards


_METRIC_LABELS: Dict[str, str] = {
    "uptime_pct": "Uptime",
    "change_failure_rate": "Change failure rate",
    "open_prs": "Open PRs",
    "payment_success_rate": "Payment success rate",
    "compliance_control_status": "Compliance control pass rate",
    "fraud_rate": "Fraud rate",
}


def _compute_health_score(
    goals: Dict[str, str],
    metrics: List[Dict[str, Any]],
    events: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Return a composite strategy health score with per-dimension breakdowns.

    Dimensions:
    - operational (35%): incidents + CVEs + uptime
    - delivery (25%): open PRs + bugs + blocked tickets
    - payments (20%): payment success + fraud rate
    - cost (10%): cloud spend vs budget
    - goals (10%): how clearly strategy aims are defined
    """
    # --- Operational ---
    active_incidents = len(_active(events, "incident"))
    critical_cves = len([e for e in events if e.get("event_type") == "dependabot_alert" and e.get("severity") in ("critical", "high")])
    uptime_metric = _pick(metrics, "uptime_pct")
    uptime = uptime_metric.get("value") if uptime_metric else None

    # Incident score: 0 incidents = 100, 30+ = 0
    incident_score = _clamp(100 - (active_incidents * 3.33))
    # CVE score: 0 critical/high = 100, 100+ = 0
    cve_score = _clamp(100 - critical_cves)
    # Uptime score: 99.99% = 100, 95% = 0
    uptime_score = _clamp(((uptime - 95) / (99.99 - 95)) * 100) if uptime else 50.0

    operational_score = _clamp((incident_score * 0.4) + (cve_score * 0.35) + (uptime_score * 0.25))

    # --- Delivery ---
    open_prs = int(_sum_recent(metrics, "open_prs"))
    open_bugs = int(_sum_recent(metrics, "open_bugs"))
    blocked_tickets = len(_active(events, "blocked_ticket"))

    # PR score: 0 = 100, 3000 = 0
    pr_score = _clamp(100 - (open_prs / 30))
    # Bug score: 0 = 100, 100 = 0
    bug_score = _clamp(100 - open_bugs)
    # Blocked score: 0 = 100, 20 = 0
    blocked_score = _clamp(100 - (blocked_tickets * 5))

    delivery_score = _clamp((pr_score * 0.4) + (bug_score * 0.35) + (blocked_score * 0.25))

    # --- Payments ---
    payment_success_metric = _pick(metrics, "payment_success_rate")
    payment_success = payment_success_metric.get("value") if payment_success_metric else None
    fraud_metric = _pick(metrics, "fraud_rate")
    fraud_rate = fraud_metric.get("value") if fraud_metric else None

    # Payment success score: 99.99% = 100, 95% = 0
    payment_score = _clamp(((payment_success - 95) / (99.99 - 95)) * 100) if payment_success else 50.0
    # Fraud score: 0% = 100, 2% = 0
    fraud_score = _clamp(100 - (fraud_rate * 50)) if fraud_rate else 80.0

    payments_score = _clamp((payment_score * 0.7) + (fraud_score * 0.3))

    # --- Cost ---
    cloud_spend_metric = _pick(metrics, "cloud_spend_mtd")
    budget_metric = next((m for m in metrics if m.get("metric_type") == "monthly_budget"), None)
    if cloud_spend_metric and budget_metric and budget_metric.get("value"):
        spend = float(cloud_spend_metric.get("value") or 0)
        budget = float(budget_metric.get("value") or 1)
        spend_pct = spend / budget * 100
        # <= 80% budget = 100, 120%+ = 0
        cost_score = _clamp(100 - ((spend_pct - 80) * 2.5))
    else:
        cost_score = 75.0

    # --- Goals clarity ---
    goal_fields = ["six_month", "quarterly", "weekly", "ai_strategy_focus"]
    filled = sum(1 for f in goal_fields if _extract_text(goals, f))
    goals_score = _clamp((filled / len(goal_fields)) * 100)

    # --- Composite ---
    composite = _clamp(
        operational_score * 0.35
        + delivery_score * 0.25
        + payments_score * 0.20
        + cost_score * 0.10
        + goals_score * 0.10
    )

    def label(score: float) -> str:
        if score >= 80:
            return "healthy"
        if score >= 60:
            return "at risk"
        if score >= 40:
            return "critical"
        return "alarm"

    return {
        "score": round(composite, 1),
        "label": label(composite),
        "dimensions": {
            "operational": {
                "score": round(operational_score, 1),
                "label": label(operational_score),
                "signals": {
                    "active_incidents": active_incidents,
                    "critical_cves": critical_cves,
                    "uptime": uptime,
                },
            },
            "delivery": {
                "score": round(delivery_score, 1),
                "label": label(delivery_score),
                "signals": {
                    "open_prs": open_prs,
                    "open_bugs": open_bugs,
                    "blocked_tickets": blocked_tickets,
                },
            },
            "payments": {
                "score": round(payments_score, 1),
                "label": label(payments_score),
                "signals": {
                    "payment_success_rate": payment_success,
                    "fraud_rate": fraud_rate,
                },
            },
            "cost": {
                "score": round(cost_score, 1),
                "label": label(cost_score),
                "signals": {
                    "cloud_spend_mtd": cloud_spend_metric.get("value") if cloud_spend_metric else None,
                    "monthly_budget": budget_metric.get("value") if budget_metric else None,
                },
            },
            "goals": {
                "score": round(goals_score, 1),
                "label": label(goals_score),
                "signals": {"filled_fields": filled, "total_fields": len(goal_fields)},
            },
        },
    }


def _derive_action_items(goals: Dict[str, str], metrics: List[Dict[str, Any]], events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    actions: List[Dict[str, Any]] = []

    # --- Engineering velocity / health ---
    open_prs = int(_sum_recent(metrics, "open_prs"))
    open_bugs = int(_sum_recent(metrics, "open_bugs"))
    open_issues = int(_sum_recent(metrics, "open_issues"))
    stuck_prs = _active(events, "stuck_pr")
    blocked_tickets = _active(events, "blocked_ticket")

    if stuck_prs:
        actions.append(_action(
            title=f"Unblock {len(stuck_prs)} stuck PR(s)",
            rationale=f"{len(stuck_prs)} PRs are stuck; stale reviews are a leading indicator of cycle-time risk.",
            section="engineering",
            priority="high" if len(stuck_prs) >= 3 else "medium",
            due_hint="this week",
        ))
    if blocked_tickets:
        actions.append(_action(
            title=f"Resolve {len(blocked_tickets)} blocked ticket(s)",
            rationale="Blocked tickets often hide cross-team dependencies and predict sprint slippage.",
            section="product",
            priority="high" if len(blocked_tickets) >= 3 else "medium",
            due_hint="this week",
        ))
    if open_bugs >= 20:
        actions.append(_action(
            title="Run a bug triage sprint",
            rationale=f"Bug backlog is at {open_bugs}; without a focused sprint, reliability goals slip.",
            section="engineering",
            priority="high",
            due_hint="next 2 weeks",
        ))
    if open_prs >= 25:
        actions.append(_action(
            title="Enforce a PR review SLA",
            rationale=f"{open_prs} open PRs indicate review queue saturation; a 24h SLA restores flow.",
            section="engineering",
            priority="medium",
            due_hint="this week",
        ))

    # --- Security ---
    cves = [e for e in events if e.get("event_type") == "dependabot_alert"]
    critical_cves = [e for e in cves if e.get("severity") in ("critical", "high")]
    if critical_cves:
        actions.append(_action(
            title=f"Patch {len(critical_cves)} critical/high CVE(s)",
            rationale="Critical CVEs in dependencies are board-level risk; patch or document compensating controls.",
            section="security",
            priority="critical",
            due_hint="48 hours",
        ))
    if len(cves) >= 10 and not critical_cves:
        actions.append(_action(
            title="Schedule dependency hygiene week",
            rationale=f"{len(cves)} open dependabot findings suggest drift; batch-upgrade low-risk packages.",
            section="security",
            priority="medium",
            due_hint="next 2 weeks",
        ))

    # --- Operations / incidents ---
    active_incidents = _active(events, "incident")
    p0p1 = [e for e in active_incidents if e.get("severity") in ("critical", "high")]
    mttr = _pick(metrics, "mttr_minutes")
    change_failure = _pick(metrics, "change_failure_rate")
    if p0p1:
        actions.append(_action(
            title=f"Close {len(p0p1)} active P0/P1 incident(s)",
            rationale="Active critical incidents must be owned and communicated before strategy work.",
            section="operations",
            priority="critical",
            due_hint="24 hours",
        ))
    if mttr and (mttr.get("value") or 0) > 60:
        actions.append(_action(
            title="Reduce MTTR below 60 minutes",
            rationale=f"Current MTTR is {mttr['value']} min; fast recovery protects quarterly delivery commitments.",
            section="operations",
            priority="high",
            due_hint="this quarter",
        ))
    if change_failure and (change_failure.get("value") or 0) > 15:
        actions.append(_action(
            title="Drive change-failure rate below 15%",
            rationale=f"Change failure rate is {change_failure['value']}%; deploy quality gates and canaries.",
            section="operations",
            priority="high",
            due_hint="this quarter",
        ))

    # --- Payments / fintech ---
    payment_success = _pick(metrics, "payment_success_rate")
    fraud_rate = _pick(metrics, "fraud_rate")
    uptime = _pick(metrics, "uptime_pct")
    if payment_success and (payment_success.get("value") or 100) < 99.5:
        actions.append(_action(
            title="Restore payment success rate to >99.5%",
            rationale=f"Payment success at {payment_success['value']}% directly impacts revenue; investigate gateway/decline codes.",
            section="payments",
            priority="critical",
            due_hint="48 hours",
        ))
    if fraud_rate and (fraud_rate.get("value") or 0) > 1.0:
        actions.append(_action(
            title="Tighten fraud controls",
            rationale=f"Fraud rate {fraud_rate['value']}% is above 1%; review rules and chargeback correlation.",
            section="payments",
            priority="high",
            due_hint="this week",
        ))
    if uptime and (uptime.get("value") or 100) < 99.9:
        actions.append(_action(
            title="Improve uptime toward 99.99%",
            rationale=f"Uptime is {uptime['value']}%; reliability is a competitive feature in fintech.",
            section="operations",
            priority="high",
            due_hint="this quarter",
        ))

    # --- Cost ---
    cloud_spend = _pick(metrics, "cloud_spend_mtd")
    budget = next((m for m in metrics if m.get("metric_type") == "monthly_budget"), None)
    if cloud_spend and budget:
        pct = (cloud_spend.get("value") or 0) / max(budget.get("value") or 1, 1) * 100
        if pct > 85:
            actions.append(_action(
                title="Review cloud cost drivers and forecast",
                rationale=f"MTD cloud spend is {pct:.0f}% of budget; identify top drivers before month-end.",
                section="cost",
                priority="high" if pct >= 100 else "medium",
                due_hint="this week",
            ))

    # --- Compliance ---
    failed_controls = [e for e in events if e.get("event_type") == "compliance_finding"]
    if failed_controls:
        actions.append(_action(
            title=f"Remediate {len(failed_controls)} failed compliance control(s)",
            rationale="Compliance findings block audit readiness and can delay go-to-market.",
            section="compliance",
            priority="high",
            due_hint="this week",
        ))

    # --- AI strategy (explicit goal) ---
    ai_focus = _extract_text(goals, "ai_strategy_focus")
    if ai_focus:
        actions.append(_action(
            title="Draft AI strategy one-pager",
            rationale=f"You flagged AI focus: {ai_focus[:80]}{'...' if len(ai_focus) > 80 else ''}. Define 3 bets, ROI, and risk guardrails.",
            section="strategy",
            priority="high",
            due_hint="this week",
        ))
        actions.append(_action(
            title="Inventory AI-readiness of data pipelines",
            rationale="AI/ML outcomes depend on clean, observable data; audit lineage and freshness.",
            section="engineering",
            priority="medium",
            due_hint="next 2 weeks",
        ))

    # --- Capacity / team ---
    team_notes = _extract_text(goals, "team_capacity_notes")
    if team_notes and any(kw in team_notes.lower() for kw in ("hiring", "open", "vacancy", "short")):
        actions.append(_action(
            title="Refresh hiring plan against quarterly goals",
            rationale="Team capacity constraints are mentioned in strategy notes; align reqs to quarterly outcomes.",
            section="team",
            priority="medium",
            due_hint="this week",
        ))

    # --- Top risks ---
    risks = _extract_text(goals, "top_risks")
    if risks:
        actions.append(_action(
            title="Socialize risk register with leadership",
            rationale="Identified risks need executive visibility and owners to become manageable.",
            section="strategy",
            priority="medium",
            due_hint="this week",
        ))

    # --- Growth levers ---
    growth = _extract_text(goals, "growth_levers")
    if growth:
        actions.append(_action(
            title="Map growth levers to metrics and owners",
            rationale="Growth initiatives succeed when each lever has a metric, owner, and weekly checkpoint.",
            section="strategy",
            priority="medium",
            due_hint="this week",
        ))

    # --- Generic quarterly anchor if light ---
    if len(actions) < 3:
        actions.append(_action(
            title="Set weekly strategy checkpoint",
            rationale="Strategy without a regular cadence drifts. Block 30 min each week to review these action items against live data.",
            section="strategy",
            priority="medium",
            due_hint="recurring",
        ))

    return sorted(actions, key=lambda a: ({"critical": 0, "high": 1, "medium": 2, "low": 3}.get(a["priority"], 2), a["title"]))


def _default_narrative(goals: Dict[str, str], metrics: List[Dict[str, Any]], events: List[Dict[str, Any]]) -> str:
    lines: List[str] = []
    six_month = _extract_text(goals, "six_month")
    quarterly = _extract_text(goals, "quarterly")
    weekly = _extract_text(goals, "weekly")

    if six_month:
        lines.append(f"**6-month aim:** {six_month}")
    if quarterly:
        lines.append(f"**Quarterly focus:** {quarterly}")
    if weekly:
        lines.append(f"**This week:** {weekly}")

    active_incidents = len(_active(events, "incident"))
    critical_cves = len([e for e in events if e.get("event_type") == "dependabot_alert" and e.get("severity") in ("critical", "high")])
    open_prs = int(_sum_recent(metrics, "open_prs"))
    open_bugs = int(_sum_recent(metrics, "open_bugs"))
    payment_success = _pick(metrics, "payment_success_rate")
    uptime = _pick(metrics, "uptime_pct")

    data_points = []
    if active_incidents:
        data_points.append(f"{active_incidents} active incident(s)")
    if critical_cves:
        data_points.append(f"{critical_cves} critical/high CVE(s)")
    if open_prs:
        data_points.append(f"{open_prs} open PR(s)")
    if open_bugs:
        data_points.append(f"{open_bugs} open bug(s)")
    if payment_success:
        data_points.append(f"{payment_success.get('value')}% payment success")
    if uptime:
        data_points.append(f"{uptime.get('value')}% uptime")

    if data_points:
        lines.append(f"**Current signals:** {', '.join(data_points)}.")

    ai_focus = _extract_text(goals, "ai_strategy_focus")
    if ai_focus:
        lines.append(
            f"**AI lens:** Your AI focus is '{ai_focus}'. Prioritize use cases with the shortest path to measurable ROI, "
            "and ring-fence experimental work behind clear guardrails (data privacy, hallucination risk, cost per inference)."
        )

    lines.append(
        "**CTO take:** Start by stabilizing anything that threatens this quarter's commitments — incidents, critical CVEs, "
        "and payment reliability. Once the floor is solid, shift energy to the quarterly bets that unlock the 6-month aim. "
        "Review this strategy weekly against the live dashboard so it stays data-informed, not document-driven."
    )
    return "\n\n".join(lines)


def _build_strategy_prompt(goals: Dict[str, str], metrics: List[Dict[str, Any]], events: List[Dict[str, Any]]) -> str:
    payment_success_metric = _pick(metrics, "payment_success_rate")
    uptime_metric = _pick(metrics, "uptime_pct")
    fraud_metric = _pick(metrics, "fraud_rate")
    mttr_metric = _pick(metrics, "mttr_minutes")
    cfr_metric = _pick(metrics, "change_failure_rate")

    data_summary = {
        "active_incidents": len(_active(events, "incident")),
        "critical_cves": len([e for e in events if e.get("event_type") == "dependabot_alert" and e.get("severity") in ("critical", "high")]),
        "open_prs": int(_sum_recent(metrics, "open_prs")),
        "open_bugs": int(_sum_recent(metrics, "open_bugs")),
        "open_issues": int(_sum_recent(metrics, "open_issues")),
        "payment_success_rate": payment_success_metric.get("value") if payment_success_metric else None,
        "uptime_pct": uptime_metric.get("value") if uptime_metric else None,
        "fraud_rate": fraud_metric.get("value") if fraud_metric else None,
        "mttr_minutes": mttr_metric.get("value") if mttr_metric else None,
        "change_failure_rate": cfr_metric.get("value") if cfr_metric else None,
    }

    return f"""You are a seasoned CTO advising a fintech engineering organization.
The leadership team has defined the following strategic aims:

6-month aim: {_extract_text(goals, 'six_month') or 'Not specified'}
Quarterly aim: {_extract_text(goals, 'quarterly') or 'Not specified'}
Weekly aim: {_extract_text(goals, 'weekly') or 'Not specified'}
AI strategy focus: {_extract_text(goals, 'ai_strategy_focus') or 'Not specified'}
Top risks: {_extract_text(goals, 'top_risks') or 'Not specified'}
Growth levers: {_extract_text(goals, 'growth_levers') or 'Not specified'}
Team capacity notes: {_extract_text(goals, 'team_capacity_notes') or 'Not specified'}

Current engineering/ops data snapshot: {json.dumps(data_summary)}

Write a concise CTO strategy narrative (3-5 paragraphs). Include:
1. A one-sentence framing of the biggest opportunity and risk.
2. What to do in the next 7 days, next 30 days, and this quarter.
3. Specific guidance on the AI strategy focus.
4. A closing principle or guardrail.
Keep it practical and slightly direct, as if from a CTO in a weekly exec standup.
"""


def _openai_narrative(prompt: str) -> str:
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        return ""
    try:
        import openai  # type: ignore
        client = openai.OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are a concise, experienced CTO writing strategy guidance."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.5,
            max_tokens=900,
        )
        return response.choices[0].message.content.strip()
    except Exception:
        return ""


def _claude_narrative(prompt: str) -> str:
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        return ""
    try:
        import anthropic  # type: ignore
        client = anthropic.Anthropic(api_key=api_key)
        kwargs: Dict[str, Any] = {
            "model": settings.CLAUDE_MODEL,
            "max_tokens": 900,
            "system": "You are a concise, experienced CTO writing strategy guidance.",
            "messages": [{"role": "user", "content": prompt}],
        }
        # Newer Claude models (e.g. claude-sonnet-5) do not accept temperature.
        if "claude-3" in settings.CLAUDE_MODEL:
            kwargs["temperature"] = 0.5
        response = client.messages.create(**kwargs)
        for block in response.content:
            if block.type == "text":
                return block.text.strip()
            if block.type == "thinking":
                # Fable returns its reasoning in a thinking block; ignore it.
                continue
        return ""
    except Exception:
        return ""


def _llm_narrative(goals: Dict[str, str], metrics: List[Dict[str, Any]], events: List[Dict[str, Any]]) -> str:
    prompt = _build_strategy_prompt(goals, metrics, events)
    # Prefer Claude if configured, otherwise try OpenAI.
    return _claude_narrative(prompt) or _openai_narrative(prompt)


INITIATIVE_BUCKETS: Dict[str, Dict[str, Any]] = {
    "platform_reliability": {
        "label": "Platform Reliability",
        "description": "Keep the engineering floor solid: uptime, incidents, CVEs, and change safety.",
        "sections": {"operations", "security", "engineering"},
        "keywords": {"uptime", "incident", "cve", "vulnerability", "mttr", "change failure", "patch", "dependabot"},
    },
    "delivery_velocity": {
        "label": "Delivery Velocity",
        "description": "Unblock teams and protect sustainable throughput.",
        "sections": {"engineering", "product"},
        "keywords": {"pr", "pull request", "blocked ticket", "bug triage", "sla", "cycle time", "sprint"},
    },
    "payments_fintech": {
        "label": "Payments & Fintech",
        "description": "Protect revenue, fraud controls, and payment experience.",
        "sections": {"payments"},
        "keywords": {"payment success", "fraud", "chargeback", "decline", "gateway", "txn"},
    },
    "cost_efficiency": {
        "label": "Cost Efficiency",
        "description": "Cloud spend discipline and unit economics.",
        "sections": {"cost"},
        "keywords": {"cloud", "budget", "cost", "spend", "forecast", "unit economics"},
    },
    "compliance_governance": {
        "label": "Compliance & Governance",
        "description": "Audit readiness, controls, and risk registers.",
        "sections": {"compliance", "security"},
        "keywords": {"compliance", "control", "audit", "risk register", "framework", "evidence"},
    },
    "ai_strategy": {
        "label": "AI Strategy",
        "description": "Safe, measurable AI bets and readiness.",
        "sections": {"strategy", "engineering"},
        "keywords": {"ai", "ml", "copilot", "model", "inference", "hallucination", "data pipeline"},
    },
    "team_capacity": {
        "label": "Team Capacity",
        "description": "Hiring, skill gaps, and org readiness to execute.",
        "sections": {"team"},
        "keywords": {"hiring", "capacity", "skill gap", "vacancy", "team"},
    },
    "growth_levers": {
        "label": "Growth Levers",
        "description": "Revenue and expansion initiatives with owners and metrics.",
        "sections": {"strategy", "payments"},
        "keywords": {"growth", "market", "geo", "partnership", "revenue", "lever"},
    },
}


def _score_action_against_bucket(action: Dict[str, Any], bucket: Dict[str, Any]) -> float:
    score = 0.0
    text = f"{action.get('title', '')} {action.get('rationale', '')} {action.get('section', '')}".lower()
    if action.get("section") in bucket["sections"]:
        score += 2.0
    for keyword in bucket["keywords"]:
        if keyword in text:
            score += 1.0
    return score


def _build_initiative_portfolio(
    action_items: List[Dict[str, Any]],
    goals: Dict[str, str],
    metrics: List[Dict[str, Any]],
    events: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Group action items into named initiative buckets with a status summary."""
    # Assign each action to its highest-scoring bucket.
    assignments: Dict[str, List[Dict[str, Any]]] = {key: [] for key in INITIATIVE_BUCKETS}
    for action in action_items:
        scores = [(key, _score_action_against_bucket(action, bucket)) for key, bucket in INITIATIVE_BUCKETS.items()]
        scores.sort(key=lambda x: x[1], reverse=True)
        best_key, best_score = scores[0]
        if best_score > 0:
            assignments[best_key].append(action)

    # Always include buckets explicitly mentioned in goals even if empty.
    goal_text = " ".join(goals.values()).lower()
    keyword_to_bucket = {
        "ai": "ai_strategy",
        "ml": "ai_strategy",
        "copilot": "ai_strategy",
        "hiring": "team_capacity",
        "vacancy": "team_capacity",
        "capacity": "team_capacity",
        "risk": "compliance_governance",
        "compliance": "compliance_governance",
        "growth": "growth_levers",
        "market": "growth_levers",
    }
    for keyword, bucket_key in keyword_to_bucket.items():
        if keyword in goal_text:
            assignments.setdefault(bucket_key, [])

    # Score a bucket status from its action items and related signals.
    def bucket_status(actions: List[Dict[str, Any]]) -> str:
        if not actions:
            return "tracking"
        priorities = [a.get("priority", "medium") for a in actions]
        if "critical" in priorities:
            return "critical"
        if "high" in priorities:
            return "at_risk"
        return "healthy"

    portfolio: List[Dict[str, Any]] = []
    for key, bucket in INITIATIVE_BUCKETS.items():
        actions = assignments.get(key, [])
        status = bucket_status(actions)
        open_count = len(actions)
        critical_count = sum(1 for a in actions if a.get("priority") == "critical")
        high_count = sum(1 for a in actions if a.get("priority") == "high")

        # Compute a completion proxy: items due this week or 48 hours likely short-term.
        near_term = sum(
            1
            for a in actions
            if a.get("due_hint") in ("this week", "48 hours", "24 hours")
        )

        portfolio.append({
            "id": f"initiative-{key}",
            "key": key,
            "label": bucket["label"],
            "description": bucket["description"],
            "status": status,
            "open_items": open_count,
            "critical_items": critical_count,
            "high_items": high_count,
            "near_term_items": near_term,
            "action_ids": [a.get("id") for a in actions],
            "sections": sorted(bucket["sections"]),
        })

    # Order: critical first, then by total open items, then label.
    priority_order = {"critical": 0, "at_risk": 1, "healthy": 2, "tracking": 3}
    portfolio.sort(key=lambda p: (priority_order.get(p["status"], 2), -p["open_items"], p["label"]))
    return portfolio


def build_strategy(
    goals: Dict[str, str],
    metrics: List[Dict[str, Any]],
    events: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Return strategy action items, narrative, health score, goal cards, and initiative portfolio.

    If an LLM key is configured, the narrative is LLM-enhanced; otherwise a
    rule-based narrative is returned. Action items, goal cards, and portfolio
    are always rule-based so they are deterministic and auditable.
    """
    action_items = _derive_action_items(goals, metrics, events)
    llm_text = _llm_narrative(goals, metrics, events)
    llm_enhanced = bool(llm_text)
    narrative = llm_text or _default_narrative(goals, metrics, events)
    health_score = _compute_health_score(goals, metrics, events)
    goal_cards = _compute_goal_cards(goals, metrics, events)
    initiative_portfolio = _build_initiative_portfolio(action_items, goals, metrics, events)

    return {
        "narrative": narrative,
        "action_items": action_items,
        "health_score": health_score,
        "goal_cards": goal_cards,
        "initiative_portfolio": initiative_portfolio,
        "data_driven": True,
        "llm_enhanced": llm_enhanced,
    }
