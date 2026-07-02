# Next CTO Dashboard Iteration Plan

## Context
The dashboard already has: Overview, Engineering, Product, Operations, Security, Cost, Team, and Settings sections with real backend data, per-widget error boundaries, export, predictions, compliance, incident command center, vendor health, fintech metrics, data quality, release timeline, and security remediation widgets.

## Fintech-Critical Gaps Identified
1. **No dedicated Payments/Business section** — fintech metrics are only a widget in Overview. CTOs need a focused view for payment success, fraud, chargebacks, settlement, and transaction volume trends.
2. **No squad-level drilldown** — filters exist but no per-squad summary cards or comparisons.
3. **No cost anomaly / burn-rate chart** — only weekly spend; need daily burn vs. forecast.
4. **No data freshness per widget** — CTOs need to know if a metric is stale (e.g., payment success stale > 5 min).
5. **No on-call rotation widget** — on-call load exists but no current primary/secondary on-call by squad.
6. **No audit / change log visibility** — critical for fintech compliance to see recent changes.

## Proposed Implementation (in order)
1. **Create `PaymentsSection`** — new sidebar nav + section with fintech metrics, transaction volume chart, fraud/chargeback trends, settlement failures, and ledger reconciliation details.
2. **Squad comparison widget** — add to Overview a grid showing key signals per squad (PRs, bugs, incidents, cost, uptime) using existing seeded squad metadata.
3. **Cost burn-rate chart** — replace weekly with daily/forecast in CostSection; add projected overrun line.
4. **Data freshness indicator** — add `lastUpdated` and age badge to each widget header; use relative time.
5. **On-call rotation widget** — show current primary/secondary on-call by squad with escalation path placeholder.
6. **Backend: add `audit_log` event type** to seed data and expose via `/events` so Compliance/Security sections can render change history.

## Success Criteria
- `npm run build` passes clean.
- New Payments section renders with real seeded metrics.
- All new widgets are responsive (stack on mobile, grid on desktop).
- No widget crash brings down the page (error boundaries already in place).
- Backend reseeds cleanly with new audit events.

## Risks
- Adding too many widgets to Overview could make it scroll-heavy → we'll keep new widgets concise and move fintech details to the new Payments section.
- `any[]` types continue to spread; acceptable for speed, but we should keep `SectionProps` updated.
