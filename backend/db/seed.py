import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from backend.db.models import Metric, Event

SQUADS = ["platform", "payments", "risk", "data"]
ENVIRONMENTS = ["prod", "staging"]
SERVICES = ["api-gateway", "payments-core", "ledger", "auth-service", "webhook-router"]


def _now() -> datetime:
    return datetime.utcnow()


def _random_recent(days: int = 90) -> datetime:
    return _now() - timedelta(
        days=random.randint(0, days),
        hours=random.randint(0, 23),
        minutes=random.randint(0, 59),
    )


def seed_metrics(db: Session, count_multiplier: int = 1) -> int:
    """Generate realistic fintech metrics over the last 90 days."""
    created = 0
    base = _now() - timedelta(days=90)

    for day_offset in range(0, 91, 3):
        ts = base + timedelta(days=day_offset)
        for squad in SQUADS:
            for env in ENVIRONMENTS:
                # Engineering signals
                db.add(
                    Metric(
                        is_seed=True,
                        source="github",
                        metric_type="open_prs",
                        entity=f"{squad}/{env}",
                        value=random.randint(3, 25),
                        meta={"squad": squad, "environment": env},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="github",
                        metric_type="median_review_time",
                        entity=f"{squad}/{env}",
                        value=round(random.uniform(1.0, 12.0), 1),
                        meta={"squad": squad, "environment": env},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="github",
                        metric_type="ci_pass_rate",
                        entity=f"{squad}/{env}",
                        value=round(random.uniform(82.0, 99.5), 1),
                        meta={"squad": squad, "environment": env},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="github",
                        metric_type="flaky_tests",
                        entity=f"{squad}/{env}",
                        value=random.randint(0, 8),
                        meta={"squad": squad, "environment": env},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="github",
                        metric_type="deploy_frequency",
                        entity=f"{squad}/{env}",
                        value=round(random.uniform(0.5, 6.0), 1),
                        meta={"squad": squad, "environment": env},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="github",
                        metric_type="change_failure_rate",
                        entity=f"{squad}/{env}",
                        value=round(random.uniform(1.0, 12.0), 1),
                        meta={"squad": squad, "environment": env},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="github",
                        metric_type="mttr_minutes",
                        entity=f"{squad}/{env}",
                        value=float(random.randint(12, 90)),
                        meta={"squad": squad, "environment": env},
                        timestamp=ts,
                    )
                )

                # Product signals
                db.add(
                    Metric(
                        is_seed=True,
                        source="jira",
                        metric_type="open_issues",
                        entity=f"{squad}/{env}",
                        value=random.randint(8, 60),
                        meta={"squad": squad, "environment": env},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="jira",
                        metric_type="open_bugs",
                        entity=f"{squad}/{env}",
                        value=random.randint(0, 20),
                        meta={"squad": squad, "environment": env},
                        timestamp=ts,
                    )
                )

                # Operations signals
                if env == "prod":
                    for svc in SERVICES:
                        db.add(
                            Metric(
                                source="observability",
                                metric_type="uptime_pct",
                                entity=svc,
                                value=round(random.uniform(98.5, 99.99), 2),
                                meta={"squad": squad, "environment": env, "service": svc},
                                timestamp=ts,
                            )
                        )
                        db.add(
                            Metric(
                                source="observability",
                                metric_type="p95_latency_ms",
                                entity=svc,
                                value=float(random.randint(80, 600)),
                                meta={"squad": squad, "environment": env, "service": svc},
                                timestamp=ts,
                            )
                        )
                        db.add(
                            Metric(
                                source="observability",
                                metric_type="latency_p99",
                                entity=svc,
                                value=round(random.uniform(80, 600), 1),
                                meta={"squad": squad, "environment": env, "service": svc},
                                timestamp=ts,
                            )
                        )
                        db.add(
                            Metric(
                                source="observability",
                                metric_type="error_rate_pct",
                                entity=svc,
                                value=round(random.uniform(0.01, 2.0), 2),
                                meta={"squad": squad, "environment": env, "service": svc},
                                timestamp=ts,
                            )
                        )
                        db.add(
                            Metric(
                                source="observability",
                                metric_type="error_rate",
                                entity=svc,
                                value=round(random.uniform(0.0001, 0.02), 4),
                                meta={"squad": squad, "environment": env, "service": svc},
                                timestamp=ts,
                            )
                        )

                # Product delivery signals
                db.add(
                    Metric(
                        is_seed=True,
                        source="jira",
                        metric_type="sprint_velocity",
                        entity=f"{squad}/{env}",
                        value=float(random.randint(25, 60)),
                        meta={"squad": squad, "environment": env},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="jira",
                        metric_type="sprint_remaining_points",
                        entity=f"{squad}/{env}",
                        value=float(random.randint(5, 45)),
                        meta={"squad": squad, "environment": env, "committed": 45},
                        timestamp=ts,
                    )
                )

                # Story-point breakdowns (sprint, per-developer, backlog)
                db.add(
                    Metric(
                        is_seed=True,
                        source="jira",
                        metric_type="backlog_story_points",
                        entity=f"{squad}/{env}",
                        value=float(random.randint(15, 80)),
                        meta={"squad": squad, "environment": env, "issue_count": random.randint(5, 30)},
                        timestamp=ts,
                    )
                )
                devs = random.sample(
                    ["alice", "bob", "carol", "dave", "erin", "frank"], k=random.randint(2, 4)
                )
                for dev in devs:
                    db.add(
                        Metric(
                            is_seed=True,
                            source="jira",
                            metric_type="developer_open_story_points",
                            entity=f"{squad}/{env}",
                            value=float(random.randint(3, 25)),
                            meta={
                                "squad": squad,
                                "environment": env,
                                "assignee_login": dev,
                                "assignee_name": dev.capitalize(),
                                "issue_count": random.randint(1, 8),
                            },
                            timestamp=ts,
                        )
                    )
                    db.add(
                        Metric(
                            is_seed=True,
                            source="jira",
                            metric_type="sprint_points_per_developer",
                            entity=f"{squad}/{env}",
                            value=float(random.randint(5, 30)),
                            meta={
                                "squad": squad,
                                "environment": env,
                                "sprint_id": random.randint(100, 999),
                                "sprint_name": f"{squad.capitalize()} Sprint {random.randint(1, 12)}",
                                "assignee_login": dev,
                                "assignee_name": dev.capitalize(),
                                "completed_points": float(random.randint(0, 20)),
                            },
                            timestamp=ts,
                        )
                    )

                # API gateway security signals
                db.add(
                    Metric(
                        is_seed=True,
                        source="api_gateway",
                        metric_type="api_total_requests",
                        entity=f"{squad}/{env}",
                        value=float(random.randint(100_000, 2_000_000)),
                        meta={"squad": squad, "environment": env},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="api_gateway",
                        metric_type="api_blocked_requests",
                        entity=f"{squad}/{env}",
                        value=float(random.randint(100, 15_000)),
                        meta={"squad": squad, "environment": env},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="api_gateway",
                        metric_type="api_rate_limited",
                        entity=f"{squad}/{env}",
                        value=float(random.randint(500, 25_000)),
                        meta={"squad": squad, "environment": env},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="api_gateway",
                        metric_type="api_abuse_score",
                        entity=f"{squad}/{env}",
                        value=round(random.uniform(10.0, 85.0), 1),
                        meta={"squad": squad, "environment": env},
                        timestamp=ts,
                    )
                )

                # Fintech business signals (only prod)
                if env == "prod":
                    db.add(
                        Metric(
                            source="payments",
                            metric_type="payment_success_rate",
                            entity=f"{squad}/{env}",
                            value=round(random.uniform(98.5, 99.95), 2),
                            meta={"squad": squad, "environment": env},
                            timestamp=ts,
                        )
                    )
                    db.add(
                        Metric(
                            source="payments",
                            metric_type="transaction_volume",
                            entity=f"{squad}/{env}",
                            value=float(random.randint(50000, 500000)),
                            meta={"squad": squad, "environment": env},
                            timestamp=ts,
                        )
                    )
                    db.add(
                        Metric(
                            source="payments",
                            metric_type="fraud_rate",
                            entity=f"{squad}/{env}",
                            value=round(random.uniform(0.05, 0.8), 2),
                            meta={"squad": squad, "environment": env},
                            timestamp=ts,
                        )
                    )
                    db.add(
                        Metric(
                            source="payments",
                            metric_type="chargeback_rate",
                            entity=f"{squad}/{env}",
                            value=round(random.uniform(0.01, 0.3), 2),
                            meta={"squad": squad, "environment": env},
                            timestamp=ts,
                        )
                    )
                    db.add(
                        Metric(
                            source="payments",
                            metric_type="settlement_failure_rate",
                            entity=f"{squad}/{env}",
                            value=round(random.uniform(0.01, 0.25), 2),
                            meta={"squad": squad, "environment": env},
                            timestamp=ts,
                        )
                    )
                    db.add(
                        Metric(
                            source="payments",
                            metric_type="ledger_imbalance",
                            entity=f"{squad}/{env}",
                            value=round(random.uniform(0.0, 5000.0), 2),
                            meta={"squad": squad, "environment": env},
                            timestamp=ts,
                        )
                    )
                    db.add(
                        Metric(
                            source="payments",
                            metric_type="reconciliation_lag_minutes",
                            entity=f"{squad}/{env}",
                            value=float(random.randint(5, 180)),
                            meta={"squad": squad, "environment": env},
                            timestamp=ts,
                        )
                    )
                    # Authorization / decline signals
                    db.add(
                        Metric(
                            source="payments",
                            metric_type="authorization_decline_rate",
                            entity=f"{squad}/{env}",
                            value=round(random.uniform(1.5, 8.5), 2),
                            meta={"squad": squad, "environment": env},
                            timestamp=ts,
                        )
                    )
                    db.add(
                        Metric(
                            source="payments",
                            metric_type="false_positive_rate",
                            entity=f"{squad}/{env}",
                            value=round(random.uniform(0.3, 4.5), 2),
                            meta={"squad": squad, "environment": env},
                            timestamp=ts,
                        )
                    )
                    db.add(
                        Metric(
                            source="payments",
                            metric_type="aml_alert_backlog",
                            entity=f"{squad}/{env}",
                            value=float(random.randint(12, 180)),
                            meta={"squad": squad, "environment": env},
                            timestamp=ts,
                        )
                    )
                    db.add(
                        Metric(
                            source="payments",
                            metric_type="reconciliation_exception_count",
                            entity=f"{squad}/{env}",
                            value=float(random.randint(0, 45)),
                            meta={"squad": squad, "environment": env},
                            timestamp=ts,
                        )
                    )
                    db.add(
                        Metric(
                            source="payments",
                            metric_type="processor_routing_failover_count",
                            entity=f"{squad}/{env}",
                            value=float(random.randint(0, 8)),
                            meta={"squad": squad, "environment": env},
                            timestamp=ts,
                        )
                    )
                    db.add(
                        Metric(
                            source="payments",
                            metric_type="kyc_pass_rate",
                            entity=f"{squad}/{env}",
                            value=round(random.uniform(88.0, 98.5), 1),
                            meta={"squad": squad, "environment": env},
                            timestamp=ts,
                        )
                    )
                    db.add(
                        Metric(
                            source="payments",
                            metric_type="kyb_pass_rate",
                            entity=f"{squad}/{env}",
                            value=round(random.uniform(82.0, 96.0), 1),
                            meta={"squad": squad, "environment": env},
                            timestamp=ts,
                        )
                    )
                    for vendor in ["stripe", "plaid", "auth0", "sendgrid", "aws-us-east-1"]:
                        db.add(
                            Metric(
                                source="vendor",
                                metric_type="vendor_health_score",
                                entity=vendor,
                                value=round(random.uniform(85.0, 99.9), 1),
                                meta={"squad": squad, "environment": env, "vendor": vendor},
                                timestamp=ts,
                            )
                        )

                # Cost signals
                spend = round(random.uniform(800, 4500), 2)
                budget = round(random.uniform(12000, 50000), 2)
                db.add(
                    Metric(
                        is_seed=True,
                        source="billing",
                        metric_type="cloud_spend_mtd",
                        entity=f"{squad}/{env}",
                        value=spend,
                        meta={"squad": squad, "environment": env},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="billing",
                        metric_type="mtd_spend",
                        entity=f"{squad}/{env}",
                        value=spend,
                        meta={"squad": squad, "environment": env},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="billing",
                        metric_type="monthly_budget",
                        entity=f"{squad}/{env}",
                        value=budget,
                        meta={"squad": squad, "environment": env},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="billing",
                        metric_type="budget_used_pct",
                        entity=f"{squad}/{env}",
                        value=round((spend / budget) * 100, 1),
                        meta={"squad": squad, "environment": env},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="billing",
                        metric_type="cloud_spend_weekly",
                        entity=f"{squad}/{env}",
                        value=round(spend / 4, 2),
                        meta={"squad": squad, "environment": env},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="billing",
                        metric_type="savings_opportunities",
                        entity=f"{squad}/{env}",
                        value=round(random.uniform(200, 1200), 2),
                        meta={"squad": squad, "environment": env},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="billing",
                        metric_type="cost_per_transaction",
                        entity=f"{squad}/{env}",
                        value=round(random.uniform(0.001, 0.015), 5),
                        meta={"squad": squad, "environment": env},
                        timestamp=ts,
                    )
                )

                # Compliance signals
                for framework in ["soc2", "pci", "iso27001", "gdpr", "sox"]:
                    progress = round(random.uniform(70.0, 99.0), 1)
                    db.add(
                        Metric(
                            source="compliance",
                            metric_type="compliance_framework_score",
                            entity=framework,
                            value=progress,
                            meta={"framework": framework, "squad": squad, "environment": env},
                            timestamp=ts,
                        )
                    )
                    for control in range(1, 13):
                        db.add(
                            Metric(
                                source="compliance",
                                metric_type="compliance_evidence",
                                entity=framework,
                                value=1.0,
                                meta={
                                    "framework": framework,
                                    "control": f"CTRL-{control:03d}",
                                    "status": random.choice(["submitted", "submitted", "pending"]),
                                    "squad": squad,
                                    "environment": env,
                                },
                                timestamp=ts,
                            )
                        )

                # Team signals
                current_headcount = random.randint(6, 18)
                target_headcount = current_headcount + random.randint(0, 4)
                db.add(
                    Metric(
                        is_seed=True,
                        source="hris",
                        metric_type="headcount",
                        entity=squad,
                        value=float(current_headcount),
                        meta={"squad": squad},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="hris",
                        metric_type="headcount_target",
                        entity=squad,
                        value=float(target_headcount),
                        meta={"squad": squad},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="hris",
                        metric_type="open_roles",
                        entity=squad,
                        value=float(target_headcount - current_headcount),
                        meta={"squad": squad},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="hris",
                        metric_type="squad_utilization",
                        entity=squad,
                        value=round(random.uniform(65.0, 95.0), 1),
                        meta={"squad": squad},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="hris",
                        metric_type="hire_time_days",
                        entity=squad,
                        value=float(random.randint(18, 90)),
                        meta={"squad": squad},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="hris",
                        metric_type="avg_hire_days",
                        entity=squad,
                        value=float(random.randint(18, 90)),
                        meta={"squad": squad},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="hris",
                        metric_type="oncall_load",
                        entity=squad,
                        value=round(random.uniform(0.5, 4.5), 1),
                        meta={"squad": squad},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="hris",
                        metric_type="pto_this_week",
                        entity=squad,
                        value=random.randint(0, 5),
                        meta={"squad": squad},
                        timestamp=ts,
                    )
                )
                db.add(
                    Metric(
                        is_seed=True,
                        source="hris",
                        metric_type="pto_days",
                        entity=squad,
                        value=random.randint(0, 12),
                        meta={"squad": squad},
                        timestamp=ts,
                    )
                )
        created += 21  # rough count per iteration

    return created


def seed_events(db: Session) -> int:
    """Generate realistic fintech events over the last 90 days."""
    created = 0

    # CVEs
    cve_titles = [
        "CVE-2024-1234 in auth-service dependency",
        "CVE-2024-5678 in payments-core library",
        "CVE-2024-9012 in ledger crypto module",
        "High severity vulnerability in webhook-router",
        "Critical dependency in api-gateway",
        "Outdated SSL library in risk service",
        "Exposed secret in legacy data pipeline",
    ]
    for i, title in enumerate(cve_titles * 4):
        severity = random.choice(["critical", "high", "high", "medium", "medium", "low"])
        db.add(
            Event(
                is_seed=True,
                source="github",
                event_type="dependabot_alert",
                entity=random.choice(SERVICES),
                title=title,
                severity=severity,
                status=random.choice(["open", "open", "dismissed", "resolved"]),
                meta={"squad": random.choice(SQUADS), "environment": random.choice(ENVIRONMENTS)},
                happened_at=_random_recent(),
            )
        )
        created += 1

    # Blocked tickets
    for i in range(30):
        db.add(
            Event(
                is_seed=True,
                source="jira",
                event_type="blocked_ticket",
                entity=f"PAY-{1000 + i}",
                title=random.choice([
                    "Payment reconciliation blocked by schema migration",
                    "Risk model update waiting on legal review",
                    "Data retention policy blocking feature launch",
                    "Auth integration blocked by vendor SLA",
                    "Ledger export blocked by downstream outage",
                ]),
                severity=random.choice(["high", "medium", "medium", "low"]),
                status="blocked",
                meta={
                    "squad": random.choice(SQUADS),
                    "owner": random.choice(["alice", "bob", "carol", "dave"]),
                },
                happened_at=_random_recent(),
            )
        )
        created += 1

    # Stuck PRs
    for i in range(25):
        db.add(
            Event(
                is_seed=True,
                source="github",
                event_type="stuck_pr",
                entity=f"repo-{random.choice(SQUADS)}/#{300 + i}",
                title=random.choice([
                    "Refactor payout flow awaiting review > 48h",
                    "Add audit logging to auth service",
                    "Update ledger batch processor",
                    "Fix flaky KYC test suite",
                    "Migrate webhook handlers to async workers",
                ]),
                severity="medium",
                status="open",
                meta={
                    "squad": random.choice(SQUADS),
                    "environment": random.choice(ENVIRONMENTS),
                    "owner": random.choice(["alice", "bob", "carol", "dave"]),
                },
                happened_at=_random_recent(),
            )
        )
        created += 1

    # Incidents
    incident_titles = [
        "Delayed payout processing in payments-core",
        "Elevated 5xx on api-gateway",
        "Auth service latency spike",
        "Ledger read replica lag",
        "Webhook delivery backlog",
        "Risk scoring service degraded",
    ]
    for i, title in enumerate(incident_titles * 3):
        started = _random_recent()
        detected = started + timedelta(minutes=random.randint(1, 12))
        acknowledged = detected + timedelta(minutes=random.randint(2, 20))
        resolved = acknowledged + timedelta(minutes=random.randint(10, 180))
        status = random.choice(["open", "resolved", "resolved", "resolved"])
        meta = {
            "squad": random.choice(SQUADS),
            "environment": "prod",
            "detected_at": detected.isoformat(),
            "acknowledged_at": acknowledged.isoformat(),
        }
        if status == "resolved":
            meta["resolved_at"] = resolved.isoformat()
        db.add(
            Event(
                is_seed=True,
                source="observability",
                event_type="incident",
                entity=random.choice(SERVICES),
                title=title,
                severity=random.choice(["critical", "high", "high", "medium"]),
                status=status,
                meta=meta,
                happened_at=started,
            )
        )
        created += 1

    # SLO breaches
    for i in range(20):
        db.add(
            Event(
                is_seed=True,
                source="observability",
                event_type="slo_breach",
                entity=random.choice(SERVICES),
                title=f"{random.choice(SERVICES)} latency p99 exceeded 500ms",
                severity=random.choice(["high", "medium", "medium"]),
                status=random.choice(["open", "resolved"]),
                meta={"squad": random.choice(SQUADS), "environment": "prod"},
                happened_at=_random_recent(),
            )
        )
        created += 1

    # Secret scanning alerts
    for i in range(8):
        db.add(
            Event(
                is_seed=True,
                source="github",
                event_type="secret_scanning_alert",
                entity=random.choice(SERVICES),
                title=random.choice([
                    "Hardcoded API key in test config",
                    "AWS credential in public repository",
                    "Database URL in CI logs",
                    "Slack webhook in committed notebook",
                ]),
                severity=random.choice(["high", "medium", "medium", "low"]),
                status=random.choice(["open", "resolved"]),
                meta={"squad": random.choice(SQUADS), "environment": random.choice(ENVIRONMENTS)},
                happened_at=_random_recent(),
            )
        )
        created += 1

    # Hiring pipeline events
    for i in range(15):
        stage_pct = [60, 30, 80, 15, 45, 70][i % 6]
        db.add(
            Event(
                is_seed=True,
                source="hris",
                event_type="hiring_pipeline",
                entity=random.choice(SQUADS),
                title=random.choice([
                    "Offer accepted — Senior Backend Engineer",
                    "Phone screen scheduled — Platform Engineer",
                    "Onsite completed — Risk Analyst",
                    "Requisition opened — Data Engineer",
                ]),
                severity="low",
                status="open",
                meta={"squad": random.choice(SQUADS), "stage_pct": stage_pct},
                happened_at=_random_recent(),
            )
        )
        created += 1

    # Team events (PTO, onboarding, training)
    for i in range(12):
        db.add(
            Event(
                is_seed=True,
                source="hris",
                event_type="team_event",
                entity=random.choice(SQUADS),
                title=f"{random.choice(['Alice', 'Bob', 'Carol', 'Dave', 'Eve'])} — {random.choice(['PTO', 'Onboarding', 'Security training'])}",
                severity="low",
                status="open",
                meta={"squad": random.choice(SQUADS)},
                happened_at=_random_recent(),
            )
        )
        created += 1

    # Cost driver events
    cost_titles = [
        "Spike in data transfer to analytics warehouse",
        "Over-provisioned EC2 instances in payments-core",
        "Unused managed database in staging environment",
        "High egress charges on webhook delivery",
        "Reserved instance about to expire",
    ]
    for i, title in enumerate(cost_titles * 2):
        db.add(
            Event(
                is_seed=True,
                source="billing",
                event_type="cost_driver",
                entity=random.choice(SERVICES),
                title=title,
                severity=random.choice(["high", "medium", "low"]),
                status="open",
                meta={"spend": round(random.uniform(200, 1500), 2), "squad": random.choice(SQUADS)},
                happened_at=_random_recent(),
            )
        )
        created += 1

    # Backup / DR events
    backup_systems = [
        ("Ledger DB", "Database", "us-west-2", 4),
        ("Payments core", "Database", "us-east-1", 1),
        ("Auth config", "Object storage", "eu-west-1", 24),
        ("Audit logs", "Object storage", "us-west-2", 24),
        ("KYC documents", "Object storage", "us-east-1", 12),
    ]
    for system, btype, dr_region, rpo in backup_systems:
        last_backup = _now() - timedelta(hours=random.uniform(0.5, rpo * 1.5))
        test_status = random.choice(["passed", "passed", "passed", "failed", "pending"])
        db.add(
            Event(
                is_seed=True,
                source="backup",
                event_type="backup_status",
                entity=system,
                title=f"{system} backup status",
                severity="low" if test_status == "passed" else "high" if test_status == "failed" else "medium",
                status=test_status,
                meta={
                    "type": btype,
                    "system": system,
                    "rpo_hours": rpo,
                    "last_backup_at": last_backup.isoformat(),
                    "dr_region": dr_region,
                    "test_status": test_status,
                },
                happened_at=last_backup,
            )
        )
        created += 1

    # API security events
    api_reasons = [
        ("Rate limit abuse", "high"),
        ("Credential stuffing pattern", "critical"),
        ("Geo-blocked region", "medium"),
        ("Known malicious IP", "high"),
        ("Invalid JWT signature", "medium"),
    ]
    for i in range(12):
        reason, severity = random.choice(api_reasons)
        db.add(
            Event(
                is_seed=True,
                source="api_gateway",
                event_type="api_security_event",
                entity="api-gateway",
                title=f"{reason} detected",
                severity=severity,
                status=random.choice(["blocked", "blocked", "monitoring"]),
                meta={
                    "ip": f"203.0.{random.randint(0, 255)}.{random.randint(0, 255)}",
                    "reason": reason,
                    "path": random.choice(["/v1/payments", "/v1/auth", "/v1/ledger"]),
                    "count": random.randint(50, 5000),
                },
                happened_at=_random_recent(),
            )
        )
        created += 1

    # Change / release management events
    change_titles = [
        ("api-gateway rate limit tuning", "platform", "approved", "medium", False),
        ("payments-core payout batch hotfix", "payments", "approved", "high", True),
        ("ledger reconciliation patch", "platform", "success", "medium", False),
        ("auth-service MFA enforcement", "security", "approved", "high", False),
        ("risk-engine model rollback", "data", "rolled_back", "critical", True),
        ("webhook-router retry policy", "platform", "pending", "low", False),
        ("data warehouse schema migration", "data", "pending", "high", False),
    ]
    for title, squad, status, severity, emergency in change_titles * 2:
        risk_score = random.randint(30, 95)
        if emergency:
            risk_score = min(100, risk_score + 20)
        db.add(
            Event(
                is_seed=True,
                source="jira",
                event_type="change_request",
                entity=random.choice(SERVICES),
                title=title,
                severity=severity,
                status=status,
                meta={
                    "squad": squad,
                    "risk_score": risk_score,
                    "emergency": emergency,
                    "approver": random.choice(["alice", "bob", "carol"]),
                },
                happened_at=_random_recent(),
            )
        )
        created += 1

    # Epic progress events
    epics = [
        ("Real-time payments v2", "payments", 72, "Sarah", "on track"),
        ("SOC 2 evidence portal", "security", 45, "Mike", "at risk"),
        ("Ledger reconciliation", "data", 90, "Priya", "closing"),
        ("API gateway abuse hardening", "platform", 30, "Jordan", "at risk"),
        ("Customer self-serve refunds", "payments", 60, "Casey", "on track"),
    ]
    for title, squad, pct, owner, status in epics:
        db.add(
            Event(
                is_seed=True,
                source="jira",
                event_type="epic_progress",
                entity=squad,
                title=title,
                severity="low",
                status="open",
                meta={"squad": squad, "pct": pct, "owner": owner, "status": status},
                happened_at=_random_recent(),
            )
        )
        created += 1

    # Authorization decline-code events
    decline_codes = [
        ("05: Do not honor", "issuer_decline"),
        ("14: Invalid card number", "card_error"),
        ("51: Insufficient funds", "issuer_decline"),
        ("54: Expired card", "card_error"),
        ("65: Activity limit exceeded", "issuer_decline"),
        ("N7: CVV2 mismatch", "security"),
        ("R0: Stop payment", "customer"),
        ("TA: 3DS authentication failed", "3ds"),
    ]
    for i in range(40):
        title, category = random.choice(decline_codes)
        db.add(
            Event(
                is_seed=True,
                source="payments",
                event_type="decline_code",
                entity="payments-core",
                title=title,
                severity=random.choice(["high", "medium", "medium", "low"]),
                status="open",
                meta={
                    "category": category,
                    "count": random.randint(50, 2500),
                    "processor": random.choice(["stripe", "adyen", "braintree"]),
                    "region": random.choice(["us", "eu", "apac"]),
                },
                happened_at=_random_recent(),
            )
        )
        created += 1

    # Reconciliation exception events
    recon_reasons = [
        ("Amount mismatch — ledger vs processor", "amount_mismatch"),
        ("Missing settlement batch reference", "missing_reference"),
        ("Duplicate transaction hash", "duplicate"),
        ("FX rate variance exceeds threshold", "fx_variance"),
        ("Refund without original capture", "orphan_refund"),
        ("Pending payout older than SLA", "aging"),
    ]
    for i in range(35):
        title, reason = random.choice(recon_reasons)
        db.add(
            Event(
                is_seed=True,
                source="payments",
                event_type="reconciliation_exception",
                entity="ledger",
                title=title,
                severity=random.choice(["high", "medium", "low"]),
                status=random.choice(["open", "open", "resolved"]),
                meta={
                    "reason": reason,
                    "amount": round(random.uniform(10.0, 5000.0), 2),
                    "currency": random.choice(["USD", "EUR", "GBP"]),
                    "age_hours": random.randint(1, 96),
                },
                happened_at=_random_recent(),
            )
        )
        created += 1

    # Fraud operations events
    fraud_events = [
        ("Rule model drift detected", "model_drift", "high"),
        ("New merchant risk tier spike", "merchant_risk", "medium"),
        ("Velocity rule triggered", "velocity", "high"),
        ("Geolocation anomaly cluster", "geo_anomaly", "medium"),
        ("AML case awaiting review", "aml_case", "high"),
        (" SAR filing due in 24h", "sar_filing", "critical"),
    ]
    for i in range(25):
        title, kind, severity = random.choice(fraud_events)
        db.add(
            Event(
                is_seed=True,
                source="risk",
                event_type="fraud_ops_alert",
                entity="risk-engine",
                title=title,
                severity=severity,
                status=random.choice(["open", "open", "resolved"]),
                meta={
                    "kind": kind,
                    "cases": random.randint(1, 80),
                    "analyst": random.choice(["alice", "bob", "carol"]),
                },
                happened_at=_random_recent(),
            )
        )
        created += 1

    # Processor routing / failover events
    processors = ["stripe", "adyen", "braintree"]
    for i in range(15):
        processor = random.choice(processors)
        healthy = random.choice([True, True, True, False])
        db.add(
            Event(
                is_seed=True,
                source="payments",
                event_type="processor_status",
                entity=processor,
                title=f"{processor} routing {'healthy' if healthy else 'failover active'}",
                severity="low" if healthy else "critical",
                status="healthy" if healthy else "degraded",
                meta={
                    "processor": processor,
                    "share_pct": random.randint(20, 60),
                    "latency_ms": random.randint(80, 400),
                    "region": random.choice(["us", "eu", "apac"]),
                },
                happened_at=_random_recent(),
            )
        )
        created += 1

    # Vendor / third-party incidents
    vendors = ["stripe", "plaid", "auth0", "sendgrid", "aws-us-east-1"]
    vendor_titles = [
        "Stripe API latency elevated",
        "Plaid connection timeouts",
        "Auth0 rate limit errors",
        "SendGrid delivery delays",
        "AWS region degraded performance",
    ]
    for i, title in enumerate(vendor_titles * 2):
        db.add(
            Event(
                is_seed=True,
                source="vendor",
                event_type="vendor_incident",
                entity=vendors[i % len(vendors)],
                title=title,
                severity=random.choice(["critical", "high", "high", "medium"]),
                status=random.choice(["open", "resolved", "resolved"]),
                meta={"vendor": vendors[i % len(vendors)], "environment": "prod"},
                happened_at=_random_recent(),
            )
        )
        created += 1

    # Release / deploy events
    release_titles = [
        "payments-core v2.14.0 — payout batching",
        "ledger v3.7.2 — reconciliation fix",
        "auth-service v1.9.0 — MFA enforcement",
        "api-gateway v4.1.0 — rate limit tuning",
        "webhook-router v2.3.1 — retry policy",
        "risk-engine v5.0.0 — model update",
    ]
    for i, title in enumerate(release_titles * 3):
        db.add(
            Event(
                is_seed=True,
                source="github",
                event_type="release_deploy",
                entity=random.choice(SERVICES),
                title=title,
                severity="low",
                status=random.choice(["success", "success", "success", "rolled_back"]),
                meta={
                    "squad": random.choice(SQUADS),
                    "environment": "prod",
                    "version": f"v{random.randint(1,9)}.{random.randint(0,99)}.{random.randint(0,99)}",
                },
                happened_at=_random_recent(),
            )
        )
        created += 1

    # Audit log events (compliance / change tracking)
    audit_actions = [
        ("github", "Repository permission changed", "medium"),
        ("github", "Branch protection rule updated", "medium"),
        ("jira", "SOC 2 evidence approved", "low"),
        ("jira", "Critical bug priority escalated", "high"),
        ("observability", "SLO threshold modified", "medium"),
        ("observability", "Alert routing updated", "low"),
        ("billing", "Reserved instance purchased", "low"),
        ("billing", "Budget alert threshold changed", "medium"),
        ("hris", "On-call schedule updated", "low"),
        ("payments", "Payment processor fallback toggled", "high"),
        ("security", "API key rotated", "medium"),
        ("security", "Firewall rule changed", "high"),
    ]
    for i, (source, action, severity) in enumerate(audit_actions * 3):
        db.add(
            Event(
                is_seed=True,
                source=source,
                event_type="audit_log",
                entity=random.choice(SERVICES),
                title=action,
                severity=severity,
                status="completed",
                meta={
                    "actor": random.choice(["alice", "bob", "carol", "dave"]),
                    "squad": random.choice(SQUADS),
                    "environment": random.choice(ENVIRONMENTS),
                },
                happened_at=_random_recent(),
            )
        )
        created += 1

    # Compliance events
    compliance_frameworks = [
        ("soc2", "SOC 2 Type II annual audit", "scheduled", "low"),
        ("pci", "PCI DSS Q2 assessment", "scheduled", "high"),
        ("iso27001", "ISO 27001 surveillance audit", "scheduled", "medium"),
        ("gdpr", "GDPR data processing review", "scheduled", "medium"),
        ("sox", "SOX ITGC quarterly review", "scheduled", "high"),
    ]
    for framework, title, status, severity in compliance_frameworks:
        db.add(
            Event(
                is_seed=True,
                source="compliance",
                event_type="audit",
                entity=framework,
                title=title,
                severity=severity,
                status=status,
                meta={"framework": framework, "owner": random.choice(["Compliance", "Security", "Legal", "Finance"])},
                happened_at=_now() + timedelta(days=random.randint(15, 90)),
            )
        )
        created += 1

    audit_finding_titles = [
        ("Missing access review evidence", "soc2", "medium"),
        ("Firewall rule documentation incomplete", "iso27001", "high"),
        ("PII retention policy not enforced in staging", "gdpr", "high"),
        ("Segregation of duties gap in payout approval", "sox", "critical"),
        ("Vendor security questionnaire overdue", "soc2", "medium"),
        ("Encryption at rest not verified for new database", "pci", "critical"),
        ("Backup restoration test missing", "soc2", "medium"),
        ("Incident response runbook stale", "iso27001", "high"),
    ]
    for i, (title, framework, severity) in enumerate(audit_finding_titles * 2):
        db.add(
            Event(
                is_seed=True,
                source="compliance",
                event_type="audit_finding",
                entity=framework,
                title=title,
                severity=severity,
                status=random.choice(["open", "open", "resolved"]),
                meta={
                    "framework": framework,
                    "owner": random.choice(["Security", "Compliance", "Platform", "Data"]),
                    "due": (_now() + timedelta(days=random.randint(-10, 30))).isoformat(),
                },
                happened_at=_random_recent(),
            )
        )
        created += 1

    compliance_controls = [
        ("Multi-factor authentication enforcement", "soc2", "open", "high"),
        ("Privileged access quarterly review", "iso27001", "resolved", "medium"),
        ("Data classification tagging", "gdpr", "open", "medium"),
        ("Change management approval workflow", "sox", "resolved", "high"),
        ("Vulnerability scanning coverage", "pci", "open", "high"),
    ]
    for title, framework, status, severity in compliance_controls:
        db.add(
            Event(
                is_seed=True,
                source="compliance",
                event_type="compliance_control_status",
                entity=framework,
                title=title,
                severity=severity,
                status=status,
                meta={"framework": framework, "owner": random.choice(["Security", "Platform"])},
                happened_at=_random_recent(),
            )
        )
        created += 1

    policies = [
        "Security policy",
        "Code of conduct",
        "PCI handling",
        "Incident response",
        "GDPR training",
        "SOX controls",
    ]
    for policy in policies:
        for person in ["alice", "bob", "carol", "dave", "eve", "frank", "grace", "henry"]:
            db.add(
                Event(
                    source="hris",
                    event_type="policy_acceptance",
                    entity=policy,
                    title=f"{policy} acknowledgement",
                    severity="low",
                    status=random.choice(["completed", "completed", "completed", "pending"]),
                    meta={"policy": policy, "person": person},
                    happened_at=_random_recent(),
                )
            )
            created += 1

    return created


def seed_if_empty(db: Session, force: bool = False) -> dict:
    metric_count = db.query(Metric).count()
    event_count = db.query(Event).count()
    if force or (metric_count == 0 and event_count == 0):
        if force:
            db.query(Metric).delete()
            db.query(Event).delete()
            db.commit()
        m = seed_metrics(db)
        e = seed_events(db)
        db.commit()
        return {"seeded_metrics": m, "seeded_events": e, "force": force}
    return {"seeded_metrics": 0, "seeded_events": 0, "existing_metrics": metric_count, "existing_events": event_count}
