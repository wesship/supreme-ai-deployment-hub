from __future__ import annotations

from collections.abc import Awaitable, Callable

from .schemas import CandidateResult, CouncilRequest

VerificationHook = Callable[[CandidateResult, CouncilRequest], Awaitable[bool]]


class CouncilVerifier:
    def __init__(self, verification_hook: VerificationHook | None = None) -> None:
        self._verification_hook = verification_hook

    async def verify(self, candidate: CandidateResult, request: CouncilRequest) -> bool:
        if not candidate.success or not candidate.safety_passed:
            candidate.verification_passed = False
            return False
        if not request.require_verification:
            candidate.verification_passed = True
            return True
        if self._verification_hook is None:
            candidate.verification_passed = False
            return False
        candidate.verification_passed = bool(await self._verification_hook(candidate, request))
        return candidate.verification_passed
