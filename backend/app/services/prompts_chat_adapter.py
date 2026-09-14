"""Prompts.chat source adapter for D3VONN Prompt Registry V2.

Uses the public REST search/get API for predictable server-to-server ingestion.
Prompts are treated as untrusted external data, screened by Guardian, and then
registered as candidate or quarantined. No imported prompt is auto-approved.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Mapping, Sequence

import httpx

from app.services.prompt_guardian import PromptGuardianScanner, PromptScreeningResult
from app.services.prompt_registry import PromptRegistryService


@dataclass(frozen=True)
class PromptsChatPrompt:
    id: str
    title: str
    content: str
    description: str | None
    category: str | None
    tags: tuple[str, ...]
    author: str | None
    prompt_type: str | None
    raw: Mapping[str, Any]


class PromptsChatAdapterError(RuntimeError):
    pass


class PromptsChatAdapter:
    """Read-only Prompts.chat adapter with governed D3VONN ingestion."""

    def __init__(
        self,
        *,
        base_url: str = "https://prompts.chat",
        timeout_seconds: float = 15.0,
        client: httpx.AsyncClient | None = None,
        registry: PromptRegistryService | None = None,
        guardian: PromptGuardianScanner | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout_seconds
        self._client = client
        self._registry = registry or PromptRegistryService()
        self._guardian = guardian or PromptGuardianScanner()

    async def _get(self, path: str, *, params: Mapping[str, Any] | None = None) -> Any:
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=self._timeout)
        try:
            response = await client.get(
                f"{self._base_url}{path}",
                params=dict(params or {}),
                headers={"Accept": "application/json", "User-Agent": "D3VONN-PromptRegistry/2"},
            )
            if response.status_code >= 400:
                raise PromptsChatAdapterError(
                    f"Prompts.chat request failed ({response.status_code}): {response.text[:500]}"
                )
            return response.json()
        finally:
            if owns_client:
                await client.aclose()

    async def search(
        self,
        query: str,
        *,
        limit: int = 10,
        category: str | None = None,
        tag: str | None = None,
    ) -> tuple[PromptsChatPrompt, ...]:
        if not query.strip():
            raise PromptsChatAdapterError("Search query cannot be empty")
        if not 1 <= limit <= 50:
            raise PromptsChatAdapterError("limit must be between 1 and 50")

        # The documented REST API exposes q/perPage. Category/tag filtering is
        # applied locally when supplied to avoid depending on undocumented REST params.
        payload = await self._get("/api/prompts", params={"q": query.strip(), "perPage": limit})
        rows = self._extract_rows(payload)
        prompts = [self._normalize(row) for row in rows]
        if category:
            prompts = [p for p in prompts if (p.category or "").lower() == category.lower()]
        if tag:
            prompts = [p for p in prompts if tag.lower() in {value.lower() for value in p.tags}]
        return tuple(prompts[:limit])

    async def get_prompt(self, prompt_id: str) -> PromptsChatPrompt:
        if not prompt_id.strip():
            raise PromptsChatAdapterError("prompt_id cannot be empty")
        payload = await self._get(f"/api/prompts/{prompt_id.strip()}")
        if isinstance(payload, Mapping) and isinstance(payload.get("prompt"), Mapping):
            payload = payload["prompt"]
        if not isinstance(payload, Mapping):
            raise PromptsChatAdapterError("Unexpected Prompts.chat prompt response")
        return self._normalize(payload)

    async def ingest_prompt(
        self,
        prompt: PromptsChatPrompt,
        *,
        scope: str = "task",
        agent_id: str | None = None,
        created_by: str = "prompts-chat-adapter",
    ) -> dict[str, Any]:
        screening = await self._guardian.scan(prompt.content, source="prompts_chat")
        slug = self._slug(prompt.title, prompt.id)
        result = await self._registry.register_prompt(
            slug=slug,
            name=prompt.title,
            content=prompt.content,
            source="prompts_chat",
            scope=scope,
            source_external_id=prompt.id,
            source_url=f"{self._base_url}/prompts/{prompt.id}",
            agent_id=agent_id,
            category=prompt.category,
            tags=prompt.tags,
            source_metadata={
                "provider": "prompts.chat",
                "author": prompt.author,
                "description": prompt.description,
                "type": prompt.prompt_type,
                "guardian_decision": screening.decision,
                "guardian_findings": list(screening.findings),
            },
            risk_score=screening.risk_score,
            created_by=created_by,
        )

        if screening.decision == "quarantine":
            prompt_id = result["prompt"]["id"]
            result["prompt"] = await self._registry.set_status(
                prompt_id=prompt_id,
                status="quarantined",
            )

        return {
            **result,
            "screening": {
                "decision": screening.decision,
                "risk_score": screening.risk_score,
                "findings": list(screening.findings),
            },
        }

    async def search_and_ingest(
        self,
        query: str,
        *,
        limit: int = 5,
        scope: str = "task",
        agent_id: str | None = None,
        category: str | None = None,
        tag: str | None = None,
    ) -> tuple[dict[str, Any], ...]:
        prompts = await self.search(query, limit=limit, category=category, tag=tag)
        results: list[dict[str, Any]] = []
        for prompt in prompts:
            results.append(
                await self.ingest_prompt(prompt, scope=scope, agent_id=agent_id)
            )
        return tuple(results)

    @staticmethod
    def _extract_rows(payload: Any) -> Sequence[Mapping[str, Any]]:
        if isinstance(payload, list):
            return [row for row in payload if isinstance(row, Mapping)]
        if isinstance(payload, Mapping):
            for key in ("prompts", "data", "items", "results"):
                value = payload.get(key)
                if isinstance(value, list):
                    return [row for row in value if isinstance(row, Mapping)]
        raise PromptsChatAdapterError("Unexpected Prompts.chat search response")

    @staticmethod
    def _normalize(row: Mapping[str, Any]) -> PromptsChatPrompt:
        prompt_id = str(row.get("id") or row.get("slug") or "").strip()
        title = str(row.get("title") or row.get("name") or "Untitled prompt").strip()
        content = str(row.get("content") or row.get("prompt") or "").strip()
        if not prompt_id or not content:
            raise PromptsChatAdapterError("Prompts.chat result missing id or content")

        raw_tags = row.get("tags") or ()
        tags: tuple[str, ...]
        if isinstance(raw_tags, list):
            tags = tuple(str(value).strip() for value in raw_tags if str(value).strip())
        else:
            tags = ()

        category = row.get("category")
        if isinstance(category, Mapping):
            category = category.get("slug") or category.get("name")

        author = row.get("author")
        if isinstance(author, Mapping):
            author = author.get("username") or author.get("name")

        return PromptsChatPrompt(
            id=prompt_id,
            title=title,
            content=content,
            description=(str(row["description"]).strip() if row.get("description") else None),
            category=(str(category).strip() if category else None),
            tags=tags,
            author=(str(author).strip() if author else None),
            prompt_type=(str(row["type"]).strip() if row.get("type") else None),
            raw=dict(row),
        )

    @staticmethod
    def _slug(title: str, prompt_id: str) -> str:
        stem = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "prompt"
        suffix = re.sub(r"[^a-z0-9]+", "", prompt_id.lower())[:16] or "external"
        value = f"pchat-{stem}-{suffix}"
        return value[:128].rstrip("-")
