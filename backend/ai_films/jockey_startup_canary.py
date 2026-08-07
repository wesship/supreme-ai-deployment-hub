"""One-time Railway production certification for TwelveLabs/Jockey reasoning."""
from __future__ import annotations

import logging
import os
from typing import Any, Mapping

from backend.ai_films.bootstrap import PROJECT_ID, SupabaseFilmBootstrapClient, _now
from backend.ai_films.twelvelabs import (
    TwelveLabsClient,
    TwelveLabsConfigurationError,
    TwelveLabsError,
)

logger = logging.getLogger(__name__)


def should_run_jockey_startup_canary(environ: Mapping[str, str] | None = None) -> bool:
    source = environ or os.environ
    if source.get("RAILWAY_ENVIRONMENT_NAME", "").strip().lower() != "production":
        return False
    disabled = source.get("AI_FILM_DISABLE_JOCKEY_STARTUP_CANARY", "").strip().lower()
    return disabled not in {"1", "true", "yes", "on"}


async def certify_jockey_on_startup(
    environ: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    """Run one real Jockey reasoning request and persist only certification metadata."""
    source = environ or os.environ
    if not should_run_jockey_startup_canary(source):
        return {"status": "skipped", "reason": "not_production_or_disabled"}

    try:
        db = SupabaseFilmBootstrapClient(environ=source)
    except RuntimeError:
        return {"status": "skipped", "reason": "supabase_not_configured"}

    project = await db.get_project(PROJECT_ID)
    if not project:
        return {"status": "skipped", "reason": "project_missing"}
    metadata = dict(project.get("metadata") or {})
    if metadata.get("jockey_canary_state") == "passed":
        return {"status": "passed", "reason": "already_certified"}

    await db.update_project_metadata(
        {
            "jockey_canary_state": "in_progress",
            "jockey_canary_started_at": _now(),
            "jockey_canary_last_error": None,
        }
    )

    try:
        client = TwelveLabsClient(environ=source)
        response = await client.reason(
            (
                "Inspect the configured AI Films knowledge store and confirm in one "
                "short sentence whether it contains indexed film material. Do not "
                "quote or reproduce transcript text."
            ),
            instructions=(
                "This is a production certification canary. Be concise, avoid "
                "sensitive metadata, and do not reproduce source content."
            ),
            include_intermediate=False,
        )
        if not isinstance(response, dict) or not response:
            raise TwelveLabsError("Jockey returned an empty certification response")

        response_id = str(response.get("_id") or response.get("id") or "") or None
        await db.update_project_metadata(
            {
                "jockey_canary_state": "passed",
                "jockey_canary_completed_at": _now(),
                "jockey_canary_response_received": True,
                "jockey_canary_response_id": response_id,
                "jockey_canary_last_error": None,
                "jockey_canary_provider": "twelvelabs-jockey",
            }
        )
        logger.info("TwelveLabs/Jockey production canary passed.")
        return {
            "status": "passed",
            "provider": "twelvelabs-jockey",
            "response_received": True,
            "response_id": response_id,
        }
    except TwelveLabsConfigurationError as exc:
        error = f"{type(exc).__name__}: configuration_missing"
    except TwelveLabsError as exc:
        error = f"{type(exc).__name__}: provider_request_failed"
    except Exception as exc:  # pragma: no cover - defensive production guard
        logger.exception("Jockey startup certification failed")
        error = f"{type(exc).__name__}: unexpected_failure"

    await db.update_project_metadata(
        {
            "jockey_canary_state": "failed",
            "jockey_canary_failed_at": _now(),
            "jockey_canary_response_received": False,
            "jockey_canary_last_error": error,
        }
    )
    return {"status": "failed", "error": error}
