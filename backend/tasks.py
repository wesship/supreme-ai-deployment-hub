"""Celery application for D3VONN.IO background workers.

This module is intentionally small and stable because the VPS Docker Compose
worker starts Celery with:

    celery -A tasks:celery worker
    celery -A tasks:celery beat

The backend Docker image uses ``backend/`` as the build context and copies its
contents into ``/app``. That means this file becomes ``/app/tasks.py`` inside the
container, so the Celery import path must remain ``tasks:celery`` for the VPS
compose stack.
"""

from __future__ import annotations

import os
from typing import Any, Dict

from celery import Celery


BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1")
RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/2")

celery = Celery(
    "d3vonn",
    broker=BROKER_URL,
    backend=RESULT_BACKEND,
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    broker_connection_retry_on_startup=True,
)


@celery.task(name="tasks.healthcheck")
def healthcheck() -> Dict[str, Any]:
    """Lightweight task used to confirm the Celery worker can boot and execute."""
    return {
        "status": "ok",
        "service": "d3vonn-celery",
        "broker": BROKER_URL,
    }
