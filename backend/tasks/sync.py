from backend.tasks.celery import celery_app
from backend.mcp.integrations import CONNECTORS


@celery_app.task
def sync_source(source: str):
    import asyncio
    connector = CONNECTORS.get(source)
    if not connector:
        return {"error": f"Unknown source: {source}"}
    return asyncio.run(_run_sync(connector()))


async def _run_sync(conn):
    health = await conn.health_check()
    if not health["ok"]:
        return health
    metrics = await conn.fetch_metrics()
    events = await conn.fetch_events()
    return {"metrics": len(metrics), "events": len(events)}
