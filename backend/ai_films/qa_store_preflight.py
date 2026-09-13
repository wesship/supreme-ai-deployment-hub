"""Validate or repair the TwelveLabs knowledge store before generated-shot QA."""
from __future__ import annotations

import os
from typing import Mapping

from backend.ai_films.twelvelabs import TwelveLabsClient, TwelveLabsError


async def ensure_qa_knowledge_store(*, environ: Mapping[str, str] | None = None) -> str:
    source = environ or os.environ
    client = TwelveLabsClient(source)
    try:
        await client.retrieve_knowledge_store()
        print("[ai-films-qa] knowledge_store=validated", flush=True)
        return client.knowledge_store_id
    except TwelveLabsError as exc:
        if "HTTP 404" not in str(exc):
            raise

    created = await client._request(
        "POST",
        "/knowledge-stores",
        payload={
            "name": "D3VONN AI Films Production QA",
            "description": "Generated-shot canon QA corpus for D3VONN.IO AI Films",
        },
        timeout_seconds=120.0,
    )
    store_id = str(created.get("_id") or created.get("id") or "").strip()
    if not store_id:
        raise RuntimeError("TwelveLabs knowledge-store repair returned no id")
    os.environ["TWELVELABS_KNOWLEDGE_STORE_ID"] = store_id
    print("[ai-films-qa] knowledge_store=repaired", flush=True)
    return store_id
