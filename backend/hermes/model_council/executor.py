from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable

from .schemas import CandidateResult, CandidateSpec, CouncilRequest

ProviderCall = Callable[[CandidateSpec, CouncilRequest], Awaitable[CandidateResult]]


class CouncilExecutor:
    def __init__(self, provider_call: ProviderCall) -> None:
        self._provider_call = provider_call

    async def run(self, request: CouncilRequest) -> list[CandidateResult]:
        semaphore = asyncio.Semaphore(request.max_parallel)

        async def invoke(spec: CandidateSpec) -> CandidateResult:
            async with semaphore:
                started = time.perf_counter()
                try:
                    result = await asyncio.wait_for(
                        self._provider_call(spec, request), timeout=spec.timeout_seconds
                    )
                    result.latency_ms = result.latency_ms or int((time.perf_counter() - started) * 1000)
                    return result
                except TimeoutError:
                    return CandidateResult(
                        provider=spec.provider,
                        model=spec.model,
                        success=False,
                        latency_ms=int((time.perf_counter() - started) * 1000),
                        error="timeout",
                    )
                except Exception as exc:
                    return CandidateResult(
                        provider=spec.provider,
                        model=spec.model,
                        success=False,
                        latency_ms=int((time.perf_counter() - started) * 1000),
                        error=f"provider_error:{type(exc).__name__}",
                    )

        return list(await asyncio.gather(*(invoke(spec) for spec in request.candidates)))
