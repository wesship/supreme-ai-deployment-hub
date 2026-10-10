"""One-time production bootstrap for The Sovereign Signal MovieFlow ingestion.

The bootstrap is intentionally Railway-only. It reuses Railway's protected
TwelveLabs and Supabase service-role environment, claims the project through a
PostgREST compare-and-set, resumes partial TwelveLabs work when IDs are already
persisted, and becomes a no-op after all MovieFlow renders are indexed.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

import httpx

from backend.ai_films.ingestion import TwelveLabsIngestionRunner, load_manifest
from backend.ai_films.twelvelabs import TwelveLabsClient, TwelveLabsConfigurationError, TwelveLabsError

logger = logging.getLogger(__name__)

PROJECT_ID = "b2979e7c-1d28-4024-bf4f-8db90c174d5a"
BATCH_ID = "sovereign-signal-batch-001"
MANIFEST_PATH = Path(__file__).resolve().parent / "manifests" / "sovereign_signal_batch_001.json"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def should_schedule_sovereign_signal_bootstrap(
    environ: Mapping[str, str] | None = None,
) -> bool:
    """Return true only for the production Railway runtime unless explicitly disabled."""
    source = environ or os.environ
    disabled = source.get("AI_FILM_DISABLE_SOVEREIGN_SIGNAL_BOOTSTRAP", "").strip().lower()
    if disabled in {"1", "true", "yes", "on"}:
        return False
    return source.get("RAILWAY_ENVIRONMENT_NAME", "").strip().lower() == "production"


class SupabaseFilmBootstrapClient:
    """Minimal service-role PostgREST client used only by the server-side bootstrap."""

    def __init__(
        self,
        environ: Mapping[str, str] | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        source = environ or os.environ
        self.base_url = source.get("SUPABASE_URL", "").strip().rstrip("/")
        self.service_role_key = source.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        self._transport = transport
        if not self.base_url or not self.service_role_key:
            raise RuntimeError("Supabase service-role runtime configuration is incomplete")
        self.headers = {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
        }

    async def _request(
        self,
        method: str,
        table: str,
        *,
        params: Mapping[str, str] | None = None,
        payload: Mapping[str, Any] | None = None,
        prefer_representation: bool = False,
    ) -> list[dict[str, Any]]:
        headers = dict(self.headers)
        if prefer_representation:
            headers["Prefer"] = "return=representation"
        try:
            async with httpx.AsyncClient(
                headers=headers,
                timeout=httpx.Timeout(30.0, connect=10.0),
                transport=self._transport,
            ) as client:
                response = await client.request(
                    method,
                    f"{self.base_url}/rest/v1/{table}",
                    params=dict(params or {}),
                    json=dict(payload) if payload is not None else None,
                )
        except httpx.HTTPError as exc:
            raise RuntimeError("Supabase bootstrap request could not be completed") from exc
        if response.status_code >= 400:
            raise RuntimeError(
                f"Supabase bootstrap request failed with HTTP {response.status_code}"
            )
        if not response.content:
            return []
        result = response.json()
        if not isinstance(result, list):
            raise RuntimeError("Supabase bootstrap returned an unexpected response shape")
        return [row for row in result if isinstance(row, dict)]

    async def get_project(self, project_id: str = PROJECT_ID) -> dict[str, Any] | None:
        rows = await self._request(
            "GET",
            "ai_film_projects",
            params={"id": f"eq.{project_id}", "select": "id,metadata,updated_at", "limit": "1"},
        )
        return rows[0] if rows else None

    async def claim_project(self, project_id: str = PROJECT_ID) -> bool:
        for _attempt in range(8):
            project = await self.get_project(project_id)
            if not project:
                raise RuntimeError("The Sovereign Signal AI Films project is missing")
            metadata = dict(project.get("metadata") or {})
            current = str(metadata.get("movieflow_ingestion_state") or "")
            if current in {"complete", "in_progress"}:
                return False
            if current not in {
                "ready_to_execute",
                "failed",
                "installed",
                "blocked_source_url",
                "",
            }:
                return False

            observed_updated_at = str(project.get("updated_at") or "")
            if not observed_updated_at:
                raise RuntimeError("AI Films project is missing updated_at for safe claim")

            claimed = dict(metadata)
            claimed.update(
                {
                    "movieflow_ingestion_state": "in_progress",
                    "movieflow_ingestion_started_at": _now(),
                    "movieflow_ingestion_last_error": None,
                    "twelvelabs_state": "movieflow_ingestion_in_progress",
                }
            )
            next_updated_at = _now()
            rows = await self._request(
                "PATCH",
                "ai_film_projects",
                params={
                    "id": f"eq.{project_id}",
                    "metadata->>movieflow_ingestion_state": f"eq.{current}",
                    "updated_at": f"eq.{observed_updated_at}",
                },
                payload={"metadata": claimed, "updated_at": next_updated_at},
                prefer_representation=True,
            )
            if rows:
                return True
            await asyncio.sleep(0)

        raise RuntimeError("AI Films project claim conflicted with concurrent metadata updates")

    async def update_project_metadata(
        self,
        updates: Mapping[str, Any],
        project_id: str = PROJECT_ID,
    ) -> None:
        """Merge metadata without losing concurrent worker updates."""
        for _attempt in range(8):
            project = await self.get_project(project_id)
            if not project:
                raise RuntimeError("The Sovereign Signal AI Films project is missing")

            observed_updated_at = str(project.get("updated_at") or "")
            if not observed_updated_at:
                raise RuntimeError("AI Films project is missing updated_at for safe metadata merge")

            metadata = dict(project.get("metadata") or {})
            metadata.update(dict(updates))
            next_updated_at = _now()
            rows = await self._request(
                "PATCH",
                "ai_film_projects",
                params={
                    "id": f"eq.{project_id}",
                    "updated_at": f"eq.{observed_updated_at}",
                },
                payload={"metadata": metadata, "updated_at": next_updated_at},
                prefer_representation=True,
            )
            if rows:
                return
            await asyncio.sleep(0)

        raise RuntimeError("AI Films metadata merge conflicted with concurrent updates")

    async def get_asset(
        self,
        *,
        source_type: str,
        source_id: str,
        project_id: str = PROJECT_ID,
    ) -> dict[str, Any] | None:
        rows = await self._request(
            "GET",
            "ai_film_assets",
            params={
                "project_id": f"eq.{project_id}",
                "metadata->>source_type": f"eq.{source_type}",
                "metadata->>source_id": f"eq.{source_id}",
                "select": "id,metadata",
                "limit": "1",
            },
        )
        return rows[0] if rows else None

    async def update_asset_metadata(
        self,
        asset_id: str,
        updates: Mapping[str, Any],
    ) -> dict[str, Any]:
        rows = await self._request(
            "GET",
            "ai_film_assets",
            params={"id": f"eq.{asset_id}", "select": "id,metadata", "limit": "1"},
        )
        if not rows:
            raise RuntimeError(f"AI Films asset {asset_id} is missing")
        metadata = dict(rows[0].get("metadata") or {})
        metadata.update(dict(updates))
        updated = await self._request(
            "PATCH",
            "ai_film_assets",
            params={"id": f"eq.{asset_id}"},
            payload={"metadata": metadata, "updated_at": _now()},
            prefer_representation=True,
        )
        if not updated:
            raise RuntimeError(f"AI Films asset {asset_id} could not be updated")
        return updated[0]


async def _ingest_movieflow_entry(
    entry: Mapping[str, Any],
    *,
    db: SupabaseFilmBootstrapClient,
    runner: TwelveLabsIngestionRunner,
) -> dict[str, Any]:
    source_id = str(entry.get("source_id") or "")
    if not source_id:
        raise RuntimeError("MovieFlow manifest entry is missing source_id")
    asset_row = await db.get_asset(source_type="movieflow", source_id=source_id)
    if not asset_row:
        raise RuntimeError(f"AI Films asset is missing for MovieFlow source {source_id}")
    asset_id = str(asset_row["id"])
    metadata = dict(asset_row.get("metadata") or {})

    twelvelabs_item_id = str(metadata.get("twelvelabs_item_id") or "")
    twelvelabs_asset_id = str(metadata.get("twelvelabs_asset_id") or "")
    state = str(metadata.get("twelvelabs_state") or "")

    if state == "ready" and twelvelabs_item_id:
        return {"source_id": source_id, "asset_id": asset_id, "status": "already_ready"}

    try:
        if not twelvelabs_asset_id:
            await db.update_asset_metadata(
                asset_id,
                {
                    "twelvelabs_state": "uploading",
                    "twelvelabs_started_at": _now(),
                    "twelvelabs_last_error": None,
                },
            )
            created = await runner._create_asset(
                url=str(entry.get("media_url") or ""),
                filename=str(entry.get("source_filename") or source_id),
                user_metadata={
                    "batch_id": BATCH_ID,
                    "project_id": PROJECT_ID,
                    "ai_film_asset_id": asset_id,
                    "source_type": "movieflow",
                    "source_id": source_id,
                },
            )
            twelvelabs_asset_id = str(created.get("_id") or created.get("id") or "")
            if not twelvelabs_asset_id:
                raise TwelveLabsError("TwelveLabs asset creation returned no id")
            await db.update_asset_metadata(
                asset_id,
                {
                    "twelvelabs_asset_id": twelvelabs_asset_id,
                    "twelvelabs_state": "asset_processing",
                },
            )

        await runner._wait_for_asset(twelvelabs_asset_id)
        await db.update_asset_metadata(asset_id, {"twelvelabs_state": "asset_ready"})

        if not twelvelabs_item_id:
            item = await runner._create_item(
                twelvelabs_asset_id,
                metadata={
                    "batch_id": BATCH_ID,
                    "project_id": PROJECT_ID,
                    "ai_film_asset_id": asset_id,
                    "source_type": "movieflow",
                    "source_id": source_id,
                },
            )
            twelvelabs_item_id = str(item.get("_id") or item.get("id") or "")
            if not twelvelabs_item_id:
                raise TwelveLabsError("TwelveLabs item creation returned no id")
            await db.update_asset_metadata(
                asset_id,
                {
                    "twelvelabs_item_id": twelvelabs_item_id,
                    "twelvelabs_state": "indexing",
                },
            )

        await runner._wait_for_item(twelvelabs_item_id)
        await db.update_asset_metadata(
            asset_id,
            {
                "twelvelabs_asset_id": twelvelabs_asset_id,
                "twelvelabs_item_id": twelvelabs_item_id,
                "twelvelabs_state": "ready",
                "twelvelabs_indexed_at": _now(),
                "twelvelabs_last_error": None,
            },
        )
        return {"source_id": source_id, "asset_id": asset_id, "status": "ready"}
    except Exception as exc:
        await db.update_asset_metadata(
            asset_id,
            {
                "twelvelabs_state": "failed",
                "twelvelabs_last_error": f"{type(exc).__name__}: {exc}",
                "twelvelabs_failed_at": _now(),
            },
        )
        raise


async def bootstrap_sovereign_signal_movieflow_ingestion(
    environ: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    """Ingest pending MovieFlow renders into TwelveLabs and persist provider IDs."""
    source = environ or os.environ
    if not should_schedule_sovereign_signal_bootstrap(source):
        return {"status": "skipped", "reason": "not_production_railway"}

    try:
        client = TwelveLabsClient(environ=source)
    except TwelveLabsConfigurationError:
        logger.warning("Sovereign Signal bootstrap skipped: TwelveLabs is not configured.")
        return {"status": "skipped", "reason": "twelvelabs_not_configured"}

    try:
        db = SupabaseFilmBootstrapClient(environ=source)
    except RuntimeError:
        logger.warning("Sovereign Signal bootstrap skipped: Supabase service role is not configured.")
        return {"status": "skipped", "reason": "supabase_not_configured"}

    claimed = await db.claim_project(PROJECT_ID)
    if not claimed:
        project = await db.get_project(PROJECT_ID)
        state = str((project or {}).get("metadata", {}).get("movieflow_ingestion_state") or "")
        return {"status": "skipped", "reason": "project_not_claimable", "state": state}

    manifest = load_manifest(MANIFEST_PATH)
    movieflow_entries = [
        entry for entry in manifest["assets"] if entry.get("source_type") == "movieflow"
    ]
    runner = TwelveLabsIngestionRunner(client=client)
    ready = 0
    skipped = 0
    failures: list[dict[str, str]] = []

    try:
        for entry in movieflow_entries:
            source_id = str(entry.get("source_id") or "")
            try:
                result = await _ingest_movieflow_entry(entry, db=db, runner=runner)
                if result["status"] == "already_ready":
                    skipped += 1
                else:
                    ready += 1
                await db.update_project_metadata(
                    {
                        "movieflow_ingestion_ready_count": ready,
                        "movieflow_ingestion_skipped_count": skipped,
                        "movieflow_ingestion_failed_count": len(failures),
                        "movieflow_ingestion_last_source_id": source_id,
                        "movieflow_ingestion_updated_at": _now(),
                    }
                )
            except Exception as exc:
                failures.append({"source_id": source_id, "error": f"{type(exc).__name__}: {exc}"})
                logger.exception("Sovereign Signal MovieFlow ingestion failed for %s", source_id)
                await db.update_project_metadata(
                    {
                        "movieflow_ingestion_ready_count": ready,
                        "movieflow_ingestion_skipped_count": skipped,
                        "movieflow_ingestion_failed_count": len(failures),
                        "movieflow_ingestion_last_source_id": source_id,
                        "movieflow_ingestion_updated_at": _now(),
                    }
                )

        completed = not failures and ready + skipped == len(movieflow_entries)
        await db.update_project_metadata(
            {
                "movieflow_ingestion_state": "complete" if completed else "failed",
                "movieflow_ingestion_completed_at": _now() if completed else None,
                "movieflow_ingestion_ready_count": ready,
                "movieflow_ingestion_skipped_count": skipped,
                "movieflow_ingestion_failed_count": len(failures),
                "movieflow_ingestion_last_error": failures[-1]["error"] if failures else None,
                "twelvelabs_state": (
                    "movieflow_ready_drive_pending" if completed else "movieflow_ingestion_failed"
                ),
            }
        )
        return {
            "status": "complete" if completed else "failed",
            "ready": ready,
            "skipped": skipped,
            "failed": len(failures),
            "total": len(movieflow_entries),
        }
    except asyncio.CancelledError:
        await db.update_project_metadata(
            {
                "movieflow_ingestion_state": "ready_to_execute",
                "movieflow_ingestion_last_error": "bootstrap_cancelled",
                "movieflow_ingestion_updated_at": _now(),
            }
        )
        raise
    except Exception as exc:
        logger.exception("Sovereign Signal MovieFlow bootstrap failed")
        await db.update_project_metadata(
            {
                "movieflow_ingestion_state": "failed",
                "movieflow_ingestion_last_error": f"{type(exc).__name__}: {exc}",
                "movieflow_ingestion_updated_at": _now(),
                "twelvelabs_state": "movieflow_ingestion_failed",
            }
        )
        return {"status": "failed", "error": f"{type(exc).__name__}: {exc}"}
