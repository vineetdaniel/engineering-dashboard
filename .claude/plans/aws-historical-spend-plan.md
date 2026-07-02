# Plan: Surface AWS historical monthly spend

## Problem
The AWS Cost connector is healthy and syncing real data, but the dashboard only shows month-to-date spend (`cloud_spend_mtd`). There is no 6- or 12-month historical monthly spend view, which is what finance/board reporting typically needs.

## Goal
Fetch the last 12 months of AWS monthly spend from Cost Explorer, store them as metrics, and render a clear historical trend chart in the Cost section.

## Approach
1. Extend `AWSCostConnector.fetch_metrics()` to call `GetCostAndUsage` with `Granularity: MONTHLY` for the trailing 12 months.
2. Emit a new `monthly_spend` metric for each month, with `meta.period` set to `YYYY-MM`.
3. Fix the `monthly_budget` zero issue: if last month spend is zero (common in dev accounts or for the first sync), fall back to current MTD projected to a full month so the budget gauge and burn forecast are useful.
4. Add a new `MonthlySpendHistory` widget in `frontend/components/widgets/` that builds a 12-month bar chart from `monthly_spend` metrics.
5. Wire the widget into `CostSection` near the top, above or alongside the existing burn charts.

## Backend changes

### `backend/mcp/integrations/aws_cost.py`
- Add `_monthly_spend_payload()` returning a 12-month `MONTHLY` `GetCostAndUsage` request.
- After the existing MTD/budget/cost-driver calls, fetch monthly history and append one `monthly_spend` metric per returned month:
  ```python
  {
      "source": "aws_cost",
      "metric_type": "monthly_spend",
      "entity": "aws",
      "value": round(month_total, 2),
      "meta": {"currency": "USD", "period": period},
      "timestamp": datetime.utcnow().isoformat(),
  }
  ```
- Fix `monthly_budget` fallback: when `last_month_total == 0`, use `mtd_spend_projected = total / day_of_month * days_in_month`.
- Keep the existing metric types untouched so current widgets keep working.

## Frontend changes

### New widget: `frontend/components/widgets/MonthlySpendHistory.tsx`
- Accept `metrics` and `dataSource`.
- Filter `monthly_spend` metrics, sort by `meta.period` ascending, take last 12.
- Build chart data: `{ label: "Jun 2026", spend: 40068, budget: 45000 }`.
- Show a `TrendChart` with two series: `spend` (bars) and `budget` (area/line) when budget data exists.
- Add a stat row: current month vs. previous month change %, trailing 3-month average, highest month.
- Re-export from `frontend/components/widgets/index.ts`.

### Update `frontend/components/sections/CostSection.tsx`
- Import `MonthlySpendHistory`.
- Place it near the top under the stat cards, in a full-width row.
- Keep existing `CostSummary`, `CostAnomalyDetection`, `BudgetBurnForecast` unchanged.

## Files to modify
1. `backend/mcp/integrations/aws_cost.py` — fetch monthly history, emit `monthly_spend`, fix budget fallback.
2. `frontend/components/widgets/MonthlySpendHistory.tsx` — new widget.
3. `frontend/components/widgets/index.ts` — re-export.
4. `frontend/components/sections/CostSection.tsx` — wire widget.

## Validation
- Re-run `POST /sync/aws_cost` against the live AWS credentials.
- Verify `/metrics?source=aws_cost&metric_type=monthly_spend` returns 12 rows.
- Run `python -m compileall backend` and `npm run build`.
- Check the Cost section renders the new chart with real AWS monthly spend.

## Open decision
- **Budget line on the chart:** Should the historical chart include a monthly budget line? The connector currently derives budget from last month + 10%, which is not a real budget. I recommend drawing the budget line only if a budget metric exists, and labeling it "Auto-estimated" to avoid implying it is an approved finance budget. A future enhancement would be a configurable `AWS_BUDGET` env var or connector setting.
- **Time range:** 12 months matches AWS Cost Explorer default and most board reports. Could be made configurable later.

## Why this design
- Reuses the existing metric/event model and chart components.
- Adds minimal new code to the connector while preserving current MTD behavior.
- A dedicated widget keeps the Cost section modular and lets users see both month-to-date burn and multi-month trends.
