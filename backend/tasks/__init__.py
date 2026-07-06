from __future__ import annotations

import os

from celery import Celery

celery = Celery(
    "d3vonn",
    broker=os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/2"),
)

celery.conf.update(
    broker_connection_retry_on_startup=True,
    task_default_queue="d3vonn",
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)


@celery.task(name="tasks.healthcheck")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
