"""Dedicated Railway worker for AI Films video execution and generated-shot QA."""
from __future__ import annotations

import asyncio
import os

from backend.ai_films.generated_shot_qa_worker_pollo import run_pollo_generated_shot_qa_worker
from backend.ai_films.openmontage_assembly_coordinator import run_openmontage_assembly_coordinator
from backend.ai_films.resilient_video_worker import run_resilient_video_worker
from backend.ai_films.twelvelabs import TwelveLabsClient, TwelveLabsError


async def _ensure_qa_store() -> str:
    client = TwelveLabsClient()
    try:
        await client.retrieve_knowledge_store()
        print(f"[ai-films-qa] knowledge_store=validated id={client.knowledge_store_id}", flush=True)
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
    print(f"[ai-films-qa] knowledge_store=repaired id={store_id}", flush=True)
    return store_id


async def main() -> None:
    await _ensure_qa_store()
    await asyncio.gather(
        run_resilient_video_worker(),
        run_pollo_generated_shot_qa_worker(),
        run_openmontage_assembly_coordinator(),
    )


if __name__ == "__main__":
    asyncio.run(main())
