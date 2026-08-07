"""Repair/migrate the canonical Jockey knowledge store from the validated index."""
from __future__ import annotations

import asyncio
import os
import time
from typing import Any

from backend.ai_films.bootstrap import PROJECT_ID, SupabaseFilmBootstrapClient, _now
from backend.ai_films.twelvelabs import TwelveLabsClient, TwelveLabsError
from backend.ai_films.twelvelabs_index import DEFAULT_AI_FILMS_INDEX_ID

STORE_NAME = "D3VONN.IO AI Films — The Sovereign Signal"


def _rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    data = payload.get("data")
    if not isinstance(data, list):
        return []
    return [row for row in data if isinstance(row, dict)]


def _id(payload: dict[str, Any]) -> str:
    return str(payload.get("_id") or payload.get("id") or "")


async def _list_all(
    client: TwelveLabsClient,
    path: str,
    *,
    page_limit: int = 50,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    page = 1
    while True:
        payload = await client._request(
            "GET",
            path,
            params={"page": page, "page_limit": page_limit},
        )
        rows.extend(_rows(payload))
        info = payload.get("page_info") if isinstance(payload.get("page_info"), dict) else {}
        total_page = int(info.get("total_page") or 1)
        if page >= total_page:
            return rows
        page += 1


async def _find_existing_store(client: TwelveLabsClient) -> dict[str, Any] | None:
    stores = await _list_all(client, "/knowledge-stores")
    for store in stores:
        metadata = store.get("metadata") if isinstance(store.get("metadata"), dict) else {}
        if str(metadata.get("d3vonn_project_id") or "") == PROJECT_ID:
            return store
        if str(store.get("name") or "") == STORE_NAME:
            return store
    return None


async def _create_store(client: TwelveLabsClient) -> dict[str, Any]:
    return await client._request(
        "POST",
        "/knowledge-stores",
        payload={
            "name": STORE_NAME,
            "description": (
                "Canonical Jockey knowledge store for D3VONN.IO AI Films — "
                "The Sovereign Signal. Migrated from the validated Models index."
            ),
            "metadata": {
                "d3vonn_project_id": PROJECT_ID,
                "source_index_id": DEFAULT_AI_FILMS_INDEX_ID,
            },
        },
    )


async def _indexed_assets(client: TwelveLabsClient) -> list[dict[str, Any]]:
    rows = await _list_all(
        client,
        f"/indexes/{DEFAULT_AI_FILMS_INDEX_ID}/indexed-assets",
    )
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
    assets: list[dict[str, Any]],
) -> list[str]:
    existing = await _existing_items(client, store_id)
    existing_by_asset = {
        str(item.get("asset_id")): _id(item)
        for item in existing
        if item.get("asset_id") and _id(item)
    }
    item_ids = [item_id for item_id in existing_by_asset.values() if item_id]

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
                    "source_index_id": DEFAULT_AI_FILMS_INDEX_ID,
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
                "GET",
                f"/knowledge-stores/{store_id}/items/{item_id}",
            )
            status = str(item.get("status") or "").lower()
            if status == "ready":
                ready += 1
            elif status == "failed":
                failed += 1
            else:
                pending += 1

        if pending == 0:
            return ready, failed, pending
        if time.monotonic() >= deadline:
            return ready, failed, pending
        await asyncio.sleep(poll_interval_seconds)


async def ensure_jockey_store_from_index(
    client: TwelveLabsClient,
    db: SupabaseFilmBootstrapClient,
    project_metadata: dict[str, Any],
) -> dict[str, Any]:
    """Create/reuse a Jockey store and populate it from ready assets in the index."""
    preferred = str(project_metadata.get("jockey_store_id") or "").strip()
    if preferred:
        client.knowledge_store_id = preferred
        os.environ["TWELVELABS_KNOWLEDGE_STORE_ID"] = preferred
        try:
            store = await client.retrieve_knowledge_store()
            return store
        except TwelveLabsError:
            pass

    try:
        store = await client.retrieve_knowledge_store()
        store_id = _id(store) or client.knowledge_store_id
        await db.update_project_metadata(
            {
                "jockey_store_id": store_id,
                "jockey_store_repair_state": "existing_store_reused",
                "jockey_store_checked_at": _now(),
            }
        )
        return store
    except TwelveLabsError as exc:
        if "HTTP 404" not in str(exc):
            raise

    existing = await _find_existing_store(client)
    store = existing or await _create_store(client)
    store_id = _id(store)
    if not store_id:
        raise TwelveLabsError("Knowledge store creation returned no id")

    client.knowledge_store_id = store_id
    os.environ["TWELVELABS_KNOWLEDGE_STORE_ID"] = store_id
    await db.update_project_metadata(
        {
            "jockey_store_id": store_id,
            "jockey_store_name": store.get("name") or STORE_NAME,
            "jockey_store_repair_state": "migrating_index_assets",
            "jockey_store_source_index_id": DEFAULT_AI_FILMS_INDEX_ID,
            "jockey_store_repair_started_at": _now(),
            "jockey_store_reachable": True,
        }
    )

    assets = await _indexed_assets(client)
    asset_ids = {str(asset.get("asset_id")) for asset in assets if asset.get("asset_id")}
    await db.update_project_metadata(
        {
            "jockey_store_source_asset_count": len(asset_ids),
            "jockey_store_repair_updated_at": _now(),
        }
    )
    if not asset_ids:
        raise TwelveLabsError("Validated index returned no ready assets to migrate")

    item_ids = await _create_missing_items(client, store_id, assets)
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
