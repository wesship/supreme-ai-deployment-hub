"""Run the idempotent Sovereign Signal MovieFlow retry and certify production progress."""
from __future__ import annotations

import asyncio
import json

from backend.ai_films.bootstrap import (
    PROJECT_ID,
    SupabaseFilmBootstrapClient,
    bootstrap_sovereign_signal_movieflow_ingestion,
)


async def main() -> None:
    client = SupabaseFilmBootstrapClient()
    before = await client.get_project(PROJECT_ID)
    before_meta = dict((before or {}).get("metadata") or {})
    print(
        json.dumps(
            {
                "before_state": before_meta.get("movieflow_ingestion_state"),
                "before_ready": before_meta.get("movieflow_ingestion_ready_count"),
                "before_failed": before_meta.get("movieflow_ingestion_failed_count"),
            }
        )
    )

    await bootstrap_sovereign_signal_movieflow_ingestion()

    after = await client.get_project(PROJECT_ID)
    after_meta = dict((after or {}).get("metadata") or {})
    evidence = {
        "after_state": after_meta.get("movieflow_ingestion_state"),
        "after_ready": after_meta.get("movieflow_ingestion_ready_count"),
        "after_failed": after_meta.get("movieflow_ingestion_failed_count"),
        "jockey_items": after_meta.get("jockey_store_item_count"),
        "last_error": after_meta.get("movieflow_ingestion_last_error"),
    }
    print(json.dumps(evidence))

    ready = int(after_meta.get("movieflow_ingestion_ready_count") or 0)
    failed = int(after_meta.get("movieflow_ingestion_failed_count") or 0)
    if ready < 1:
        raise SystemExit(
            f"MOVIEFLOW_RETRY_NOT_CERTIFIED: ready={ready} failed={failed} "
            f"state={after_meta.get('movieflow_ingestion_state')}"
        )


if __name__ == "__main__":
    asyncio.run(main())
