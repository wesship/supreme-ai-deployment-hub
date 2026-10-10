"""
Devonn.AI optional W&B / Weave instrumentation.

This module is deliberately fail-open:
- If WANDB_API_KEY is missing, tracing is disabled.
- If wandb/weave are not installed or fail to initialize, the app continues.
- No secret values are logged or exported.
"""

from __future__ import annotations

import logging
import os
import time
from contextlib import contextmanager
from typing import Any, Iterator

logger = logging.getLogger(__name__)

_WEAVE_INITIALIZED = False
_WEAVE_AVAILABLE = False

try:  # pragma: no cover - availability depends on optional package install
    import weave  # type: ignore

    _WEAVE_AVAILABLE = True
except Exception:  # pragma: no cover
    weave = None  # type: ignore


def is_weave_enabled() -> bool:
    """Return true when Weave tracing should be active."""
    return os.getenv("WANDB_WEAVE_ENABLED", "false").lower() in {"1", "true", "yes", "on"}


def init_weave() -> bool:
    """Initialize Weave once when configured.

    Returns True when tracing is ready, False otherwise.
    """
    global _WEAVE_INITIALIZED

    if _WEAVE_INITIALIZED:
        return True

    if not is_weave_enabled():
        logger.info("W&B Weave tracing disabled. Set WANDB_WEAVE_ENABLED=true to enable.")
        return False

    if not os.getenv("WANDB_API_KEY"):
        logger.warning("W&B Weave requested but WANDB_API_KEY is not set; tracing disabled.")
        return False

    if not _WEAVE_AVAILABLE or weave is None:
        logger.warning("W&B Weave requested but weave package is unavailable; tracing disabled.")
        return False

    project = os.getenv("WANDB_PROJECT", "devonn-ai")
    entity = os.getenv("WANDB_ENTITY", "").strip()
    weave_ref = f"{entity}/{project}" if entity else project

    try:
        weave.init(weave_ref)
        _WEAVE_INITIALIZED = True
        logger.info("W&B Weave initialized for project=%s", project)
        return True
    except Exception as exc:  # pragma: no cover - external service path
        logger.warning("W&B Weave initialization failed; tracing disabled. error=%s", exc)
        return False


@contextmanager
def trace_operation(name: str, metadata: dict[str, Any] | None = None) -> Iterator[dict[str, Any]]:
    """Lightweight timing context for operations.

    The context always yields a mutable record. Weave initialization is handled
    elsewhere; this wrapper keeps request code clean and safe.
    """
    start = time.perf_counter()
    record: dict[str, Any] = {
        "operation": name,
        "metadata": metadata or {},
        "started_at_perf": start,
    }
    try:
        yield record
        record["status"] = "ok"
    except Exception as exc:
        record["status"] = "error"
        record["error_type"] = type(exc).__name__
        raise
    finally:
        record["duration_ms"] = round((time.perf_counter() - start) * 1000, 2)
        if is_weave_enabled():
            logger.info(
                "ai_trace operation=%s status=%s duration_ms=%s metadata=%s",
                record.get("operation"),
                record.get("status"),
                record.get("duration_ms"),
                record.get("metadata"),
            )


def weave_op(fn: Any) -> Any:
    """Decorate a function with weave.op() when Weave is available and enabled."""
    if is_weave_enabled() and _WEAVE_AVAILABLE and weave is not None:
        try:
            return weave.op()(fn)
        except Exception:
            return fn
    return fn
