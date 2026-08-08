"""Railway production certification and runtime hydration for TwelveLabs/Jockey."""
from __future__ import annotations

import logging
import os
from typing import Any, Mapping

from backend.ai_films.bootstrap import PROJECT_ID, SupabaseFilmBootstrapClient, _now
from backend.ai_films.jockey_store_repair import ensure_jockey_store_from_index
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


def _hydrate_persisted_store(metadata: Mapping[str, Any]) -> str:
    """Restore the canonical repaired store into process state after every deploy."""
    store_id = str(metadata.get("jockey_store_id") or "").strip()
    if store_id:
        os.environ["TWELVELABS_KNOWLEDGE_STORE_ID"] = store_id
    source_index_id = str(metadata.get("jockey_store_source_index_id") or "").strip()
    if source_index_id:
        os.environ["TWELVELABS_INDEX_ID"] = source_index_id
    return store_id


async def certify_jockey_on_startup(
    environ: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    """Hydrate/repair the canonical Jockey store, then certify reasoning when needed."""
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

    # A repaired store ID is durable in Supabase but Railway process environment
    # is ephemeral. Rehydrate it before constructing any TwelveLabs client.
    persisted_store_id = _hydrate_persisted_store(metadata)

    if metadata.get("jockey_canary_state") == "passed" and persisted_store_id:
        try:
            client = TwelveLabsClient()
            store = await client.retrieve_knowledge_store()
            store_id = str(store.get("_id") or store.get("id") or client.knowledge_store_id)
            await db.update_project_metadata(
                {
                    "jockey_store_reachable": True,
                    "jockey_store_id": store_id,
                    "jockey_store_checked_at": _now(),
                    "jockey_runtime_hydrated_at": _now(),
                }
            )
            logger.info("Rehydrated certified TwelveLabs/Jockey store %s on startup.", store_id)
            return {
                "status": "passed",
                "reason": "already_certified_runtime_rehydrated",
                "knowledge_store_id": store_id,
            }
        except (TwelveLabsConfigurationError, TwelveLabsError):
            # Persisted certification is not sufficient if the stored resource is
            # no longer reachable; fall through to repair/re-certification.
            logger.warning("Persisted Jockey store was not reachable; repairing before startup certification.")

    await db.update_project_metadata(
        {
            "jockey_canary_state": "in_progress",
            "jockey_canary_started_at": _now(),
            "jockey_canary_last_error": None,
        }
    )

    phase = "configuration"
    try:
        # Use os.environ so the hydrated canonical store takes precedence over
        # a stale process/deployment value supplied in the original mapping.
        client = TwelveLabsClient()

        phase = "knowledge_store_repair"
        store = await ensure_jockey_store_from_index(client, db, metadata)
        store_id = str(store.get("_id") or store.get("id") or client.knowledge_store_id)
        os.environ["TWELVELABS_KNOWLEDGE_STORE_ID"] = store_id
        await db.update_project_metadata(
            {
                "jockey_store_reachable": True,
                "jockey_store_id": store_id,
                "jockey_store_name": store.get("name"),
                "jockey_store_item_count": store.get("item_count"),
                "jockey_store_checked_at": _now(),
                "jockey_runtime_hydrated_at": _now(),
            }
        )

        phase = "reason"
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
        error = f"{phase}:{type(exc).__name__}: configuration_missing"
    except TwelveLabsError as exc:
        error = f"{phase}:{type(exc).__name__}: {str(exc)}"
        if phase == "knowledge_store_repair":
            await db.update_project_metadata(
                {
                    "jockey_store_reachable": False,
                    "jockey_store_checked_at": _now(),
                }
            )
    except Exception as exc:  # pragma: no cover - defensive production guard
        logger.exception("Jockey startup certification failed phase=%s", phase)
        error = f"{phase}:{type(exc).__name__}: unexpected_failure"

    await db.update_project_metadata(
        {
            "jockey_canary_state": "failed",
            "jockey_canary_failed_at": _now(),
            "jockey_canary_response_received": False,
            "jockey_canary_last_error": error,
        }
    )
    return {"status": "failed", "error": error}
