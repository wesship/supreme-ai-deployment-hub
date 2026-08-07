"""Repair/migrate the canonical Jockey knowledge store from a visible Models index."""
from __future__ import annotations

import asyncio
import os
import time
from typing import Any

from backend.ai_films.bootstrap import PROJECT_ID, SupabaseFilmBootstrapClient, _now
from backend.ai_films.twelvelabs import TwelveLabsClient, TwelveLabsError
from backend.ai_films.twelvelabs_index import DEFAULT_AI_FILMS_INDEX_ID

STORE_NAME = "D3VONN.IO AI Films — The Sovereign Signal"
DEFAULT_INDEX_NAMES = {"my index (default)", "my index", "d3vonn.io ai films"}


def _rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    data = payload.get("data")
    return [row for row in data if isinstance(row, dict)] if isinstance(data, list) else []


def _id(payload: dict[str, Any]) -> str:
    return str(payload.get("_id") or payload.get("id") or "")


async def _list_all(
    client: TwelveLabsClient,
    path: str,
    *,
    page_limit: int = 50,
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    page = 1
    while True:
        payload = await client._request(
            "GET", path, params={"page": page, "page_limit": page_limit}
        )
        result.extend(_rows(payload))
        info = payload.get("page_info") if isinstance(payload.get("page_info"), dict) else {}
        total_page = int(info.get("total_page") or 1)
        if page >= total_page:
            return result
        page += 1


async def _find_existing_store(client: TwelveLabsClient) -> dict[str, Any] | None:
    for store in await _list_all(client, "/knowledge-stores"):
        metadata = store.get("metadata") if isinstance(store.get("metadata"), dict) else {}
        if str(metadata.get("d3vonn_project_id") or "") == PROJECT_ID:
            return store
        if str(store.get("name") or "") == STORE_NAME:
            return store
    return None


async def _create_store(client: TwelveLabsClient, source_index_id: str) -> dict[str, Any]:
    return await client._request(
        "POST",
        "/knowledge-stores",
        payload={
            "name": STORE_NAME,
            "description": (
                "Canonical Jockey knowledge store for D3VONN.IO AI Films — "
                "The Sovereign Signal. Migrated from a validated Models index."
            ),
            "metadata": {
                "d3vonn_project_id": PROJECT_ID,
                "source_index_id": source_index_id,
            },
        },
    )


async def _resolve_source_index(
    client: TwelveLabsClient,
    db: SupabaseFilmBootstrapClient,
    project_metadata: dict[str, Any],
) -> str:
    """Resolve an index visible to the Railway API key without guessing across projects."""
    candidates = [
        str(project_metadata.get("jockey_store_source_index_id") or "").strip(),
        str(project_metadata.get("twelvelabs_index_id") or "").strip(),
        os.getenv("TWELVELABS_INDEX_ID", "").strip(),
        DEFAULT_AI_FILMS_INDEX_ID,
    ]
    seen: set[str] = set()
    for index_id in candidates:
        if not index_id or index_id in seen:
            continue
        seen.add(index_id)
        try:
            index = await client._request("GET", f"/indexes/{index_id}")
            await db.update_project_metadata(
                {
                    "jockey_store_source_index_id": index_id,
                    "jockey_source_index_name": index.get("index_name") or index.get("name"),
                    "jockey_source_index_visibility": "visible",
                    "jockey_source_index_checked_at": _now(),
                }
            )
            return index_id
        except TwelveLabsError as exc:
            if "HTTP 404" not in str(exc):
                raise

    indexes = await _list_all(client, "/indexes")
    summaries = [
        {
            "id": _id(index),
            "name": str(index.get("index_name") or index.get("name") or ""),
            "video_count": int(index.get("video_count") or 0),
        }
        for index in indexes
        if _id(index)
    ]
    await db.update_project_metadata(
        {
            "jockey_visible_index_count": len(summaries),
            "jockey_visible_index_ids": [row["id"] for row in summaries[:20]],
            "jockey_visible_index_names": [row["name"] for row in summaries[:20]],
            "jockey_source_index_visibility": "discovery_required",
            "jockey_source_index_checked_at": _now(),
        }
    )

    named = [row for row in summaries if row["name"].strip().lower() in DEFAULT_INDEX_NAMES]
    if len(named) == 1:
        chosen = named[0]
    else:
        # A single non-empty index is safe to select. Never guess among multiple projects.
        non_empty = [row for row in summaries if row["video_count"] > 0]
        if len(non_empty) != 1:
            raise TwelveLabsError(
                "Validated index is not visible to the production API key and no unique matching index was found"
            )
        chosen = non_empty[0]

    await db.update_project_metadata(
        {
            "jockey_store_source_index_id": chosen["id"],
            "jockey_source_index_name": chosen["name"],
            "jockey_source_index_visibility": "discovered",
            "jockey_source_index_checked_at": _now(),
        }
    )
    os.environ["TWELVELABS_INDEX_ID"] = chosen["id"]
    return chosen["id"]


async def _indexed_assets(client: TwelveLabsClient, index_id: str) -> list[dict[str, Any]]:
    rows = await _list_all(client, f"/indexes/{index_id}/indexed-assets")
    return [
        row
        for row in rows
        if str(row.get("status") or "").lower() == "ready" and row.get("asset_id")
    ]


async def _existing_items(client: TwelveLabsClient, store_id: str) -> list[dict[str, Any]]:
    return await _list_all(client, f"/knowledge-stores/{store_id}/items")


async def _create_missing_items(
    client: TwelveLabsClient,
    store_id: str,
    source_index_id: str,
    assets: list[dict[str, Any]],
) -> list[str]:
    existing = await _existing_items(client, store_id)
    existing_by_asset = {
        str(item.get("asset_id")): _id(item)
        for item in existing
        if item.get("asset_id") and _id(item)
    }
    item_ids = list(existing_by_asset.values())

    for asset in assets:
        asset_id = str(asset.get("asset_id") or "")
        if not asset_id or asset_id in existing_by_asset:
            continue
        metadata = asset.get("system_metadata") if isinstance(asset.get("system_metadata"), dict) else {}
        filename = str(metadata.get("filename") or asset.get("filename") or "")
        created = await client._request(
            "POST",
            f"/knowledge-stores/{store_id}/items",
            payload={
                "asset_id": asset_id,
                "metadata": {
                    "d3vonn_project_id": PROJECT_ID,
                    "source_index_id": source_index_id,
                    "source_filename": filename,
                },
            },
        )
        item_id = _id(created)
        if not item_id:
            raise TwelveLabsError("Knowledge store item creation returned no id")
        item_ids.append(item_id)
    return item_ids


async def _wait_for_items(
    client: TwelveLabsClient,
    store_id: str,
    item_ids: list[str],
    *,
    timeout_seconds: float = 1800.0,
    poll_interval_seconds: float = 10.0,
) -> tuple[int, int, int]:
    deadline = time.monotonic() + timeout_seconds
    while True:
        ready = failed = pending = 0
        for item_id in item_ids:
            item = await client._request(
                "GET", f"/knowledge-stores/{store_id}/items/{item_id}"
            )
            status = str(item.get("status") or "").lower()
            if status == "ready":
                ready += 1
            elif status == "failed":
                failed += 1
            else:
                pending += 1
        if pending == 0 or time.monotonic() >= deadline:
            return ready, failed, pending
        await asyncio.sleep(poll_interval_seconds)


async def ensure_jockey_store_from_index(
    client: TwelveLabsClient,
    db: SupabaseFilmBootstrapClient,
    project_metadata: dict[str, Any],
) -> dict[str, Any]:
    """Create/reuse a Jockey store and populate it from ready indexed assets."""
    source_index_id = await _resolve_source_index(client, db, project_metadata)

    store: dict[str, Any] | None = None
    preferred = str(project_metadata.get("jockey_store_id") or "").strip()
    if preferred:
        client.knowledge_store_id = preferred
        os.environ["TWELVELABS_KNOWLEDGE_STORE_ID"] = preferred
        try:
            store = await client.retrieve_knowledge_store()
            if project_metadata.get("jockey_store_repair_state") == "ready":
                return store
        except TwelveLabsError as exc:
            if "HTTP 404" not in str(exc):
                raise
            store = None

    if store is None:
        try:
            candidate = await client.retrieve_knowledge_store()
            if _id(candidate):
                store = candidate
        except TwelveLabsError as exc:
            if "HTTP 404" not in str(exc):
                raise

    if store is None:
        store = await _find_existing_store(client)
    if store is None:
        store = await _create_store(client, source_index_id)

    store_id = _id(store) or client.knowledge_store_id
    if not store_id:
        raise TwelveLabsError("Knowledge store creation returned no id")

    client.knowledge_store_id = store_id
    os.environ["TWELVELABS_KNOWLEDGE_STORE_ID"] = store_id
    await db.update_project_metadata(
        {
            "jockey_store_id": store_id,
            "jockey_store_name": store.get("name") or STORE_NAME,
            "jockey_store_repair_state": "migrating_index_assets",
            "jockey_store_source_index_id": source_index_id,
            "jockey_store_repair_started_at": _now(),
            "jockey_store_reachable": True,
        }
    )

    assets = await _indexed_assets(client, source_index_id)
    asset_ids = {str(asset.get("asset_id")) for asset in assets if asset.get("asset_id")}
    await db.update_project_metadata(
        {
            "jockey_store_source_asset_count": len(asset_ids),
            "jockey_store_repair_updated_at": _now(),
        }
    )
    if not asset_ids:
        raise TwelveLabsError("Resolved source index returned no ready assets to migrate")

    item_ids = await _create_missing_items(client, store_id, source_index_id, assets)
    await db.update_project_metadata(
        {
            "jockey_store_item_target_count": len(item_ids),
            "jockey_store_repair_state": "indexing_items",
            "jockey_store_repair_updated_at": _now(),
        }
    )

    ready, failed, pending = await _wait_for_items(client, store_id, item_ids)
    state = "ready" if failed == 0 and pending == 0 and ready == len(item_ids) else "partial"
    await db.update_project_metadata(
        {
            "jockey_store_repair_state": state,
            "jockey_store_ready_count": ready,
            "jockey_store_failed_count": failed,
            "jockey_store_pending_count": pending,
            "jockey_store_item_count": len(item_ids),
            "jockey_store_repair_completed_at": _now() if state == "ready" else None,
            "jockey_store_repair_updated_at": _now(),
        }
    )
    if state != "ready":
        raise TwelveLabsError(
            f"Knowledge store migration incomplete ready={ready} failed={failed} pending={pending}"
        )
    return await client.retrieve_knowledge_store()
