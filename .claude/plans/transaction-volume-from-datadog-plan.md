# Plan: Derive cost-per-transaction from Datadog transaction volume

## Goal
Make the **Cost Per Transaction Drilldown** widget show real numbers by pulling transaction/request volume from Datadog (or New Relic) and dividing AWS cloud spend by that volume.

## Approach
1. Add configurable transaction-volume query templates to the observability connector settings for Datadog and New Relic.
2. During observability sync, fetch transaction volume per service and emit `transaction_volume` metrics.
3. In the AWS Cost connector, after fetching MTD cloud spend, aggregate transaction volumes from the DB or from recent metrics and emit `cost_per_transaction` = `cloud_spend_mtd / total_transaction_volume`.
4. Update the frontend widget labels and tooltips to clarify that transaction volume comes from observability.

## Backend changes

### `backend/config.py`
Add default transaction volume query templates for Datadog and New Relic:
```python
DD_TRANSACTION_VOLUME_QUERY: str = "sum:trace.http.request.hits{service:%s,env:%s}.as_count()"
NR_TRANSACTION_VOLUME_QUERY: str = "SELECT count(*) FROM Transaction WHERE appName = '%s' AND environment = '%s' SINCE 24 hours ago"
```

### `backend/config_store.py`
Add the new keys to the observability defaults.

### `backend/mcp/integrations/observability_datadog.py`
- Add `transaction_volume` to `query_specs` using `DD_TRANSACTION_VOLUME_QUERY`.
- The metric type is `transaction_volume` and value is request count.

### `backend/mcp/integrations/observability_newrelic.py`
- Add `transaction_volume` to `query_specs` using `NR_TRANSACTION_VOLUME_QUERY`.

### `backend/api/main.py`
- Add setup guide fields for the new query templates under the observability guide.

### `backend/mcp/integrations/aws_cost.py`
- After computing `cloud_spend_mtd`, fetch recent `transaction_volume` metrics from the DB (or accept via config) and sum them.
- Emit `cost_per_transaction` metric:
  ```python
  {
      "source": "aws_cost",
      "metric_type": "cost_per_transaction",
      "entity": "aws",
      "value": round(total_spend / max(1, total_volume), 6),
      "meta": {"mtd_spend": total_spend, "volume": total_volume, "currency": "USD"},
      "timestamp": now.isoformat(),
  }
  ```
- This requires the AWS Cost connector to read from the same DB session. Currently the connector is stateless; we can either:
  - Pass the DB session into `fetch_metrics`, or
  - Let the sync endpoint compute it after calling the connector.

The simpler approach is to compute it in `POST /sync/aws_cost` after fetching metrics, using the DB session available there.

## Frontend changes
- Update `CostPerTransactionDrilldown.tsx` subtitle to say "Unit economics from AWS spend ÷ observability transaction volume".
- No other changes needed; it already consumes `cost_per_transaction` and `transaction_volume`.

## Files to modify
1. `backend/config.py`
2. `backend/config_store.py`
3. `backend/mcp/integrations/observability_datadog.py`
4. `backend/mcp/integrations/observability_newrelic.py`
5. `backend/api/main.py`
6. `backend/mcp/integrations/aws_cost.py` or `backend/api/main.py` sync endpoint
7. `frontend/components/widgets/CostPerTransactionDrilldown.tsx`

## Validation
- `python -m compileall backend`
- `npm run build`
- Sync observability connector, then AWS Cost connector, and verify `cost_per_transaction` has a real value.

## Why this design
- Reuses existing observability and AWS connectors.
- Transaction volume query is configurable because different teams instrument different metrics (HTTP hits, custom business events, etc.).
- Keeps cost-per-transaction computation close to where both inputs are available.
