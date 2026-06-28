from celery import Celery
from celery.schedules import crontab
from backend.config import settings

celery_app = Celery(
    "cto_dash",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["backend.tasks.sync"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "sync-all-connectors-hourly": {
            "task": "backend.tasks.sync.sync_all_connectors",
            "schedule": 3600.0,  # every hour
        },
    },
)
