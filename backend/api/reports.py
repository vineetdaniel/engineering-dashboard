"""PDF newsletter generator for the Reports section.

Produces a one-page executive tech newsletter summarising the last 7 days of
metrics and events. Charts are rendered with matplotlib and embedded as images
into a ReportLab PDF.
"""

import io
import base64
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import JSONB

from backend.api import schemas
from backend.db.models import Metric, Event
from backend.api.schemas import MetricOut, EventOut


def _last_7d_window() -> datetime:
    return datetime.utcnow() - timedelta(days=7)


def _get_metrics(db: Session, since: datetime) -> List[schemas.MetricOut]:
    rows = (
        db.query(Metric)
        .filter(Metric.timestamp >= since)
        .order_by(Metric.timestamp.desc())
        .all()
    )
    return [MetricOut.model_validate(r).model_dump(mode="json") for r in rows]


def _get_events(db: Session, since: datetime) -> List[schemas.EventOut]:
    rows = (
        db.query(Event)
        .filter(Event.happened_at >= since)
        .order_by(Event.happened_at.desc())
        .all()
    )
    return [EventOut.model_validate(r).model_dump(mode="json") for r in rows]


def _sum_by_day(items: List[Dict[str, Any]], date_key: str, predicate) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for item in items:
        if not predicate(item):
            continue
        day = (item.get(date_key) or datetime.utcnow().isoformat())[:10]
        counts[day] = counts.get(day, 0) + 1
    return counts


def _metric_value(metrics: List[Dict[str, Any]], metric_type: str) -> Optional[float]:
    for m in metrics:
        if m.get("metric_type") == metric_type and m.get("value") is not None:
            return float(m["value"])
    return None


def _top_cost_drivers(metrics: List[Dict[str, Any]], limit: int = 5) -> List[Dict[str, Any]]:
    drivers = [
        {"service": m.get("entity") or "Unknown", "spend": float(m.get("value") or 0)}
        for m in metrics
        if m.get("metric_type") == "cost_driver" and m.get("source") == "aws_cost"
    ]
    drivers.sort(key=lambda x: x["spend"], reverse=True)
    return drivers[:limit]


def _squad_table(metrics: List[Dict[str, Any]], events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    squads: Dict[str, Dict[str, int]] = {}
    for m in metrics:
        squad = m.get("meta", {}).get("squad") or m.get("entity") or "platform"
        squads.setdefault(squad, {"prs": 0, "bugs": 0, "incidents": 0})
        if m.get("metric_type") == "open_prs":
            squads[squad]["prs"] += int(m.get("value") or 0)
        if m.get("metric_type") == "open_bugs":
            squads[squad]["bugs"] += int(m.get("value") or 0)
    for e in events:
        squad = e.get("meta", {}).get("squad") or e.get("entity") or "platform"
        squads.setdefault(squad, {"prs": 0, "bugs": 0, "incidents": 0})
        if e.get("event_type") == "incident":
            squads[squad]["incidents"] += 1
    return [{"squad": k, **v} for k, v in sorted(squads.items())]


def _make_incident_chart(days: List[str], counts: List[int]) -> bytes:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    plt.figure(figsize=(5.5, 2.4), dpi=120)
    plt.bar(days, counts, color="#f43f5e", width=0.6, edgecolor="white")
    plt.xlabel("Day", fontsize=9)
    plt.ylabel("Incidents", fontsize=9)
    plt.title("Daily incident count (last 7 days)", fontsize=11, weight="bold")
    plt.grid(axis="y", linestyle="--", alpha=0.4)
    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format="png", transparent=True)
    plt.close()
    buf.seek(0)
    return buf.getvalue()


def _make_cost_chart(drivers: List[Dict[str, Any]]) -> bytes:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    labels = [d["service"][:16] for d in drivers]
    values = [d["spend"] for d in drivers]
    plt.figure(figsize=(5.5, 2.4), dpi=120)
    plt.barh(labels[::-1], values[::-1], color="#0ea5e9", edgecolor="white")
    plt.xlabel("USD", fontsize=9)
    plt.title("Top AWS cost drivers", fontsize=11, weight="bold")
    plt.grid(axis="x", linestyle="--", alpha=0.4)
    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format="png", transparent=True)
    plt.close()
    buf.seek(0)
    return buf.getvalue()


def generate_newsletter_pdf(db: Session) -> bytes:
    """Build and return a 7-day tech newsletter PDF as bytes."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        SimpleDocTemplate,
        Paragraph,
        Spacer,
        Table,
        TableStyle,
        Image,
        PageBreak,
    )

    since = _last_7d_window()
    metrics = _get_metrics(db, since)
    events = _get_events(db, since)

    closed_prs = sum(1 for e in events if e.get("event_type") == "merged_pr")
    incidents = [e for e in events if e.get("event_type") == "incident"]
    open_incidents = [e for e in incidents if e.get("status") != "resolved"]
    resolved_incidents = [e for e in incidents if e.get("status") == "resolved"]
    new_cves = sum(1 for e in events if e.get("event_type") == "dependabot_alert")
    blocked = sum(1 for e in events if e.get("event_type") == "blocked_ticket" and e.get("status") != "resolved")
    cost_alerts = sum(1 for e in events if e.get("event_type") == "cost_driver")

    mtd_spend = _metric_value(metrics, "cloud_spend_mtd") or 0
    budget_used = _metric_value(metrics, "budget_used_pct") or 0
    savings = _metric_value(metrics, "savings_opportunities") or 0
    cost_per_txn = _metric_value(metrics, "cost_per_transaction")

    deploys = sum(1 for m in metrics if m.get("metric_type") in ("deployment", "deployments"))
    failed_deploys = sum(1 for e in events if e.get("event_type") == "deployment_failure")
    cfr = (failed_deploys / (deploys + failed_deploys) * 100) if (deploys + failed_deploys) > 0 else 0

    days = [(datetime.utcnow() - timedelta(days=i)).date().isoformat() for i in range(6, -1, -1)]
    day_labels = [d[5:] for d in days]
    incident_counts = [_sum_by_day(events, "happened_at", lambda e: e.get("event_type") == "incident").get(d, 0) for d in days]
    cost_drivers = _top_cost_drivers(metrics)
    squad_rows = _squad_table(metrics, events)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, rightMargin=0.6 * inch, leftMargin=0.6 * inch, topMargin=0.6 * inch, bottomMargin=0.6 * inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Title"], fontSize=22, spaceAfter=10, textColor=colors.HexColor("#1e293b"))
    heading_style = ParagraphStyle("Heading", parent=styles["Heading2"], fontSize=13, spaceAfter=6, textColor=colors.HexColor("#334155"))
    body_style = ParagraphStyle("Body", parent=styles["BodyText"], fontSize=10, leading=14, spaceAfter=8)
    small_style = ParagraphStyle("Small", parent=styles["BodyText"], fontSize=9, leading=12, textColor=colors.HexColor("#64748b"))

    story: List[Any] = []
    period = f"{since.date().isoformat()} to {datetime.utcnow().date().isoformat()}"
    story.append(Paragraph("CTO Dash — Tech Newsletter", title_style))
    story.append(Paragraph(f"7-day executive summary · {period}", small_style))
    story.append(Spacer(1, 0.15 * inch))

    def metric_box(label: str, value: str, color: str):
        return Table(
            [[Paragraph(f"<b>{value}</b>", ParagraphStyle("Value", parent=styles["BodyText"], fontSize=16, alignment=1, textColor=colors.HexColor(color)))], [Paragraph(label, ParagraphStyle("Label", parent=styles["BodyText"], fontSize=9, alignment=1, textColor=colors.HexColor("#64748b")))]],
            colWidths=[1.7 * inch],
            rowHeights=[0.35 * inch, 0.22 * inch],
        )

    summary_table = Table(
        [
            [
                metric_box("PRs merged", str(closed_prs), "#10b981"),
                metric_box("Open incidents", str(len(open_incidents)), "#f43f5e"),
                metric_box("New CVEs", str(new_cves), "#f59e0b"),
                metric_box("Budget used", f"{round(budget_used)}%", "#0ea5e9"),
            ]
        ],
        colWidths=[1.7 * inch] * 4,
    )
    summary_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])
    )
    story.append(summary_table)
    story.append(Spacer(1, 0.2 * inch))

    story.append(Paragraph("Engineering, Operations &amp; Cost", heading_style))
    rows = [
        ["Open PRs", str(sum(int(m.get("value") or 0) for m in metrics if m.get("metric_type") == "open_prs")),
         "Deployments", str(deploys)],
        ["Open bugs", str(sum(int(m.get("value") or 0) for m in metrics if m.get("metric_type") == "open_bugs")),
         "Failed deploys", str(failed_deploys)],
        ["Blocked tickets", str(blocked),
         "Change failure rate", f"{cfr:.1f}%"],
        ["MTD cloud spend", f"${mtd_spend:,.0f}",
         "Savings opportunities", f"${savings:,.0f}"],
        ["Cost / transaction", f"${cost_per_txn:.4f}" if cost_per_txn else "—",
         "Cost alerts", str(cost_alerts)],
    ]
    detail_table = Table(rows, colWidths=[1.8 * inch, 1.2 * inch, 1.8 * inch, 1.2 * inch])
    detail_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#334155")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ])
    )
    story.append(detail_table)
    story.append(Spacer(1, 0.2 * inch))

    incident_img = Image(io.BytesIO(_make_incident_chart(day_labels, incident_counts)), width=2.8 * inch, height=1.2 * inch)
    cost_img = Image(io.BytesIO(_make_cost_chart(cost_drivers)), width=2.8 * inch, height=1.2 * inch)
    chart_table = Table([[incident_img, cost_img]], colWidths=[3.1 * inch, 3.1 * inch])
    story.append(chart_table)
    story.append(Spacer(1, 0.15 * inch))

    if squad_rows:
        story.append(Paragraph("Squad spotlight", heading_style))
        squad_data = [["Squad", "Open PRs", "Open bugs", "Incidents"]] + [
            [r["squad"].capitalize(), str(r["prs"]), str(r["bugs"]), str(r["incidents"])] for r in squad_rows[:6]
        ]
        squad_table = Table(squad_data, colWidths=[2.2 * inch, 1.3 * inch, 1.3 * inch, 1.3 * inch])
        squad_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
            ])
        )
        story.append(squad_table)
        story.append(Spacer(1, 0.15 * inch))

    if open_incidents[:3]:
        story.append(Paragraph("Open incidents requiring attention", heading_style))
        for inc in open_incidents[:3]:
            title = inc.get("title") or "Incident"
            sev = (inc.get("severity") or "medium").upper()
            entity = inc.get("entity") or "—"
            story.append(Paragraph(f"• <b>[{sev}]</b> {title} <i>({entity})</i>", body_style))

    if new_cves > 0:
        cve_sample = [e for e in events if e.get("event_type") == "dependabot_alert"][:3]
        story.append(Paragraph("Security highlights", heading_style))
        for cve in cve_sample:
            title = cve.get("title") or "CVE"
            sev = (cve.get("severity") or "medium").upper()
            story.append(Paragraph(f"• <b>[{sev}]</b> {title}", body_style))

    if cost_alerts > 0:
        alert_sample = [e for e in events if e.get("event_type") == "cost_driver"][:3]
        story.append(Paragraph("Cost anomalies", heading_style))
        for alert in alert_sample:
            title = alert.get("title") or "Cost alert"
            story.append(Paragraph(f"• {title}", body_style))

    story.append(Spacer(1, 0.2 * inch))
    story.append(Paragraph("Generated by CTO Dash · cto-dash.huey.tech", small_style))

    doc.build(story)
    buf.seek(0)
    return buf.read()
