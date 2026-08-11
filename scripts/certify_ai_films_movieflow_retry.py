"""Run the idempotent Sovereign Signal MovieFlow retry and certify production progress."""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from backend.ai_films.bootstrap import (  # noqa: E402
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
                "project_id": PROJECT_ID,
                "before_state": before_meta.get("movieflow_ingestion_state"),
                "before_ready": before_meta.get("movieflow_ingestion_ready_count"),
                "before_skipped": before_meta.get("movieflow_ingestion_skipped_count"),
                "before_failed": before_meta.get("movieflow_ingestion_failed_count"),
            }
        )
    )

    result = await bootstrap_sovereign_signal_movieflow_ingestion()

    after = await client.get_project(PROJECT_ID)
    after_meta = dict((after or {}).get("metadata") or {})
    evidence = {
        "bootstrap_result": result,
        "after_state": after_meta.get("movieflow_ingestion_state"),
        "after_ready": after_meta.get("movieflow_ingestion_ready_count"),
        "after_skipped": after_meta.get("movieflow_ingestion_skipped_count"),
        "after_failed": after_meta.get("movieflow_ingestion_failed_count"),
        "jockey_items": after_meta.get("jockey_store_item_count"),
        "last_error": after_meta.get("movieflow_ingestion_last_error"),
    }
    print(json.dumps(evidence))

    state = str(after_meta.get("movieflow_ingestion_state") or "")
    ready = int(after_meta.get("movieflow_ingestion_ready_count") or 0)
    skipped = int(after_meta.get("movieflow_ingestion_skipped_count") or 0)
    failed = int(after_meta.get("movieflow_ingestion_failed_count") or 0)
    indexed = ready + skipped

    if state != "complete" or failed != 0 or indexed < 1:
        raise SystemExit(
            "MOVIEFLOW_RETRY_NOT_CERTIFIED: "
            f"state={state} ready={ready} skipped={skipped} failed={failed} indexed={indexed}"
        )


if __name__ == "__main__":
    asyncio.run(main())
