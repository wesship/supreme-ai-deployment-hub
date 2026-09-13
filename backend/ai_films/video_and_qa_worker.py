"""Dedicated Railway worker for AI Films video execution and generated-shot QA."""
from __future__ import annotations

import asyncio

from backend.ai_films.generated_shot_qa_worker_pollo import run_pollo_generated_shot_qa_worker
from backend.ai_films.resilient_video_worker import run_resilient_video_worker


async def main() -> None:
    await asyncio.gather(
        run_resilient_video_worker(),
        run_pollo_generated_shot_qa_worker(),
    )


if __name__ == "__main__":
    asyncio.run(main())
