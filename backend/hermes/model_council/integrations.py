from __future__ import annotations

import os
import re
from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from backend.research_os.agents import EvidenceRankerAgent
from backend.research_os.models import EvidenceItem

from .schemas import CandidateResult, CandidateSpec, CouncilRequest

OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"


def _token_set(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-zA-Z0-9]{4,}", text.lower())
        if token not in {"that", "this", "with", "from", "have", "will", "your", "into", "about"}
    }


class OpenAIChatCouncilProvider:
    """First production provider adapter for Hermes Model Council.

    It follows the repository's existing server-side OpenAI proxy pattern: the
    API key is read only on the server, requests use httpx, and provider errors
    are surfaced to CouncilExecutor for per-candidate isolation.
    """

    def __init__(
        self,
        api_key: str | None = None,
        *,
        endpoint: str = OPENAI_CHAT_URL,
        client_factory: Callable[[], httpx.AsyncClient] | None = None,
    ) -> None:
        self._api_key = api_key or os.getenv("OPENAI_API_KEY")
        self._endpoint = endpoint
        self._client_factory = client_factory or (lambda: httpx.AsyncClient(timeout=60.0))

    async def __call__(self, spec: CandidateSpec, request: CouncilRequest) -> CandidateResult:
        if spec.provider.lower() != "openai":
            raise ValueError(f"unsupported_provider:{spec.provider}")
        if not self._api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured")

        messages: list[dict[str, str]] = []
        system_prompt = request.context.get("system_prompt")
        if isinstance(system_prompt, str) and system_prompt.strip():
            messages.append({"role": "system", "content": system_prompt.strip()})
        messages.append({"role": "user", "content": request.prompt})

        payload: dict[str, Any] = {
            "model": spec.model,
            "messages": messages,
            "stream": False,
        }
        if "temperature" in spec.metadata:
            payload["temperature"] = spec.metadata["temperature"]
        if "max_tokens" in spec.metadata:
            payload["max_tokens"] = spec.metadata["max_tokens"]

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._api_key}",
        }

        async with self._client_factory() as client:
            response = await client.post(self._endpoint, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

        choices = data.get("choices") or []
        if not choices:
            raise RuntimeError("provider_returned_no_choices")
        message = choices[0].get("message") or {}
        content = message.get("content") or ""
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("provider_returned_empty_content")

        usage = data.get("usage") or {}
        metadata = {
            "finish_reason": choices[0].get("finish_reason"),
            "usage": usage,
            "provider_request_id": response.headers.get("x-request-id"),
        }

        # Provider adapters do not self-award groundedness or safety. Those are
        # established by downstream verification/safety gates. A successful,
        # non-empty response gets only conservative completion/confidence priors.
        return CandidateResult(
            provider="openai",
            model=spec.model,
            content=content.strip(),
            success=True,
            task_completion=0.5,
            confidence=0.5,
            metadata=metadata,
        )


async def research_evidence_verification_hook(
    candidate: CandidateResult,
    request: CouncilRequest,
) -> bool:
    """Verify a candidate against ranked Research OS evidence in request context.

    Expected context shape: ``{"evidence": [EvidenceItem-like dicts]}``.
    Verification is deliberately conservative: at least one ranked item must be
    relevant enough to the prompt and the candidate must share substantive terms
    with the top evidence. No evidence means no verification.
    """

    raw_evidence = request.context.get("evidence")
    if not isinstance(raw_evidence, list) or not raw_evidence:
        return False

    evidence: list[EvidenceItem] = []
    for item in raw_evidence:
        try:
            evidence.append(item if isinstance(item, EvidenceItem) else EvidenceItem.model_validate(item))
        except Exception:
            continue
    if not evidence:
        return False

    ranked = EvidenceRankerAgent().rank(request.prompt, evidence, limit=8)
    if not ranked:
        return False

    evidence_floor = float(request.context.get("evidence_score_floor", 0.30))
    overlap_floor = float(request.context.get("evidence_overlap_floor", 0.08))
    qualifying = [item for item in ranked if item.score >= evidence_floor]
    if not qualifying:
        return False

    candidate_terms = _token_set(candidate.content)
    evidence_terms = _token_set(" ".join(f"{item.title} {item.snippet}" for item in qualifying))
    if not candidate_terms or not evidence_terms:
        return False

    overlap = len(candidate_terms & evidence_terms) / max(len(candidate_terms), 1)
    candidate.groundedness = min(1.0, max(candidate.groundedness, overlap))
    candidate.metadata["verification"] = {
        "evidence_count": len(qualifying),
        "top_evidence_score": qualifying[0].score,
        "term_overlap": round(overlap, 4),
    }
    return overlap >= overlap_floor


def build_production_council_policy():
    """Build the first real provider + Research OS verification policy."""

    from .policy import ModelCouncilPolicy

    return ModelCouncilPolicy(
        provider_call=OpenAIChatCouncilProvider(),
        verification_hook=research_evidence_verification_hook,
    )
