from backend.tasks.celery import celery_app
from backend.mcp.integrations import CONNECTORS


@celery_app.task
def sync_source(source: str):
    import asyncio
    connector = CONNECTORS.get(source)
    if not connector:
        return {"error": f"Unknown source: {source}"}
    return asyncio.run(_run_sync(connector()))


@celery_app.task
def sync_all_connectors():
    """Sync every registered connector hourly via Celery Beat."""
    import asyncio
    results = {}
    for name in CONNECTORS.keys():
        try:
            conn = _connector_with_config(name)
            results[name] = asyncio.run(_run_sync(conn))
        except Exception as e:
            results[name] = {"error": str(e)}
    return results

@celery_app.task
def periodic_sync():
    """Run sync and schedule next run in 1 hour."""
    # Run sync directly without waiting for result
    sync_all_connectors.delay()
    # Schedule next run in 1 hour
    periodic_sync.apply_async(countdown=3600)
    return {"status": "sync triggered", "next_run": "in 1 hour"}


async def _run_sync(conn):
    health = await conn.health_check()
    if not health["ok"]:
        return health
    metrics = await conn.fetch_metrics()
    events = await conn.fetch_events()
    return {"metrics": len(metrics), "events": len(events)}


def _connector_with_config(name: str):
    """Create connector with merged config (env + DB)."""
    from backend.db.models import get_db
    from backend.config_store import get_connector_config
    
    db = next(get_db())
    try:
        config = get_connector_config(name, db)
        return CONNECTORS[name](config=config)
    finally:
        db.close()
