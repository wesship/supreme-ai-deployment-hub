"""Governed D3VONN runtime prompt registry.

This service sits beneath the static prompts/agents/registry.json authority.
It stores task/workflow/agent prompt material, provenance, immutable versions,
and evaluation telemetry in Supabase using the server-side service-role key.

External sources such as Prompts.chat are never allowed to create system-scope
prompts and always enter the registry as ``candidate`` until explicitly approved.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from typing import Any, Mapping, Sequence

import httpx

from app.config import get_settings


_ALLOWED_SOURCES = {"internal", "prompts_chat", "generated", "tenant"}
_ALLOWED_SCOPES = {"system", "agent", "workflow", "task"}
_ALLOWED_STATUSES = {"candidate", "reviewed", "approved", "quarantined", "retired"}
_SOURCE_PRIORITY = {"internal": 0, "tenant": 1, "generated": 2, "prompts_chat": 3}
_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{1,127}$")


class PromptRegistryError(RuntimeError):
    """Raised when prompt registry validation or persistence fails."""


@dataclass(frozen=True)
class ResolvedPrompt:
    prompt_id: str
    version_id: str
    slug: str
    source: str
    scope: str
    content: str
    variables: Mapping[str, Any]
    checksum: str
    risk_score: float
    quality_score: float | None
    model_compatibility: tuple[str, ...]


class PromptRegistryService:
    """Service-role-only PostgREST client for governed runtime prompts."""

    def __init__(
        self,
        *,
        base_url: str | None = None,
        service_role_key: str | None = None,
        timeout_seconds: float = 15.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        settings = get_settings()
        self._base_url = (base_url or settings.supabase_url).rstrip("/")
        self._key = service_role_key or settings.supabase_service_role_key
        self._timeout = timeout_seconds
        self._client = client

        if not self._base_url or not self._key:
            raise PromptRegistryError(
                "Prompt registry requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
            )

    @staticmethod
    def checksum(content: str) -> str:
        normalized = content.replace("\r\n", "\n").strip()
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    @staticmethod
    def _validate_slug(slug: str) -> None:
        if not _SLUG_RE.fullmatch(slug):
            raise PromptRegistryError(
                "Prompt slug must be 2-128 lowercase characters using a-z, 0-9, '.', '_' or '-'"
            )

    @staticmethod
    def _validate_source_scope(source: str, scope: str) -> None:
        if source not in _ALLOWED_SOURCES:
            raise PromptRegistryError(f"Unsupported prompt source: {source}")
        if scope not in _ALLOWED_SCOPES:
            raise PromptRegistryError(f"Unsupported prompt scope: {scope}")
        if source != "internal" and scope == "system":
            raise PromptRegistryError("External prompts cannot use system scope")

    async def _request(
        self,
        method: str,
        table: str,
        *,
        params: Mapping[str, str] | None = None,
        json_body: Any = None,
        prefer: str | None = None,
    ) -> Any:
        headers = {
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer

        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=self._timeout)
        try:
            response = await client.request(
                method,
                f"{self._base_url}/rest/v1/{table}",
                params=dict(params or {}),
                headers=headers,
                json=json_body,
            )
            if response.status_code >= 400:
                raise PromptRegistryError(
                    f"Supabase prompt registry request failed ({response.status_code}): "
                    f"{response.text[:500]}"
                )
            if not response.content:
                return None
            return response.json()
        finally:
            if owns_client:
                await client.aclose()

    async def register_prompt(
        self,
        *,
        slug: str,
        name: str,
        content: str,
        source: str,
        scope: str,
        source_external_id: str | None = None,
        source_url: str | None = None,
        agent_id: str | None = None,
        category: str | None = None,
        tags: Sequence[str] = (),
        variables: Mapping[str, Any] | None = None,
        source_metadata: Mapping[str, Any] | None = None,
        risk_score: float = 0.0,
        quality_score: float | None = None,
        model_compatibility: Sequence[str] = (),
        created_by: str | None = None,
    ) -> dict[str, Any]:
        """Create a candidate prompt and immutable version 1.

        Non-internal prompts are deliberately forced to candidate status. Internal
        prompts also begin as candidate here so approval always remains explicit.
        """
        self._validate_slug(slug)
        self._validate_source_scope(source, scope)
        if source != "internal" and not source_external_id:
            raise PromptRegistryError("External prompts require source_external_id")
        if not content.strip():
            raise PromptRegistryError("Prompt content cannot be empty")
        if not 0 <= risk_score <= 1:
            raise PromptRegistryError("risk_score must be between 0 and 1")
        if quality_score is not None and not 0 <= quality_score <= 1:
            raise PromptRegistryError("quality_score must be between 0 and 1")

        registry_rows = await self._request(
            "POST",
            "prompt_registry",
            json_body={
                "slug": slug,
                "name": name.strip(),
                "source": source,
                "source_external_id": source_external_id,
                "source_url": source_url,
                "scope": scope,
                "agent_id": agent_id,
                "category": category,
                "tags": list(dict.fromkeys(tags)),
                "status": "candidate",
                "created_by": created_by,
            },
            prefer="return=representation",
        )
        if not registry_rows:
            raise PromptRegistryError("Supabase did not return the created prompt")
        registry = registry_rows[0]

        version_rows = await self._request(
            "POST",
            "prompt_versions",
            json_body={
                "prompt_id": registry["id"],
                "version": 1,
                "content": content.strip(),
                "variables": dict(variables or {}),
                "source_metadata": dict(source_metadata or {}),
                "checksum": self.checksum(content),
                "risk_score": risk_score,
                "quality_score": quality_score,
                "model_compatibility": list(dict.fromkeys(model_compatibility)),
            },
            prefer="return=representation",
        )
        if not version_rows:
            raise PromptRegistryError("Supabase did not return the created prompt version")
        version = version_rows[0]

        updated_rows = await self._request(
            "PATCH",
            "prompt_registry",
            params={"id": f"eq.{registry['id']}"},
            json_body={"active_version_id": version["id"]},
            prefer="return=representation",
        )
        if not updated_rows:
            raise PromptRegistryError("Failed to activate initial prompt version")

        return {"prompt": updated_rows[0], "version": version}

    async def add_version(
        self,
        *,
        prompt_id: str,
        content: str,
        variables: Mapping[str, Any] | None = None,
        source_metadata: Mapping[str, Any] | None = None,
        risk_score: float = 0.0,
        quality_score: float | None = None,
        model_compatibility: Sequence[str] = (),
        activate: bool = False,
    ) -> dict[str, Any]:
        """Append a new immutable version. Existing versions are never updated."""
        if not content.strip():
            raise PromptRegistryError("Prompt content cannot be empty")
        if not 0 <= risk_score <= 1:
            raise PromptRegistryError("risk_score must be between 0 and 1")

        rows = await self._request(
            "GET",
            "prompt_versions",
            params={
                "prompt_id": f"eq.{prompt_id}",
                "select": "version",
                "order": "version.desc",
                "limit": "1",
            },
        )
        next_version = (int(rows[0]["version"]) + 1) if rows else 1
        version_rows = await self._request(
            "POST",
            "prompt_versions",
            json_body={
                "prompt_id": prompt_id,
                "version": next_version,
                "content": content.strip(),
                "variables": dict(variables or {}),
                "source_metadata": dict(source_metadata or {}),
                "checksum": self.checksum(content),
                "risk_score": risk_score,
                "quality_score": quality_score,
                "model_compatibility": list(dict.fromkeys(model_compatibility)),
            },
            prefer="return=representation",
        )
        version = version_rows[0]
        if activate:
            await self.activate_version(prompt_id=prompt_id, version_id=version["id"])
        return version

    async def set_status(self, *, prompt_id: str, status: str) -> dict[str, Any]:
        if status not in _ALLOWED_STATUSES:
            raise PromptRegistryError(f"Unsupported prompt status: {status}")
        rows = await self._request(
            "PATCH",
            "prompt_registry",
            params={"id": f"eq.{prompt_id}"},
            json_body={"status": status},
            prefer="return=representation",
        )
        if not rows:
            raise PromptRegistryError(f"Prompt not found: {prompt_id}")
        return rows[0]

    async def activate_version(self, *, prompt_id: str, version_id: str) -> dict[str, Any]:
        version_rows = await self._request(
            "GET",
            "prompt_versions",
            params={
                "id": f"eq.{version_id}",
                "prompt_id": f"eq.{prompt_id}",
                "select": "id",
                "limit": "1",
            },
        )
        if not version_rows:
            raise PromptRegistryError("Version does not belong to the requested prompt")
        rows = await self._request(
            "PATCH",
            "prompt_registry",
            params={"id": f"eq.{prompt_id}"},
            json_body={"active_version_id": version_id},
            prefer="return=representation",
        )
        if not rows:
            raise PromptRegistryError(f"Prompt not found: {prompt_id}")
        return rows[0]

    async def resolve(
        self,
        *,
        scope: str,
        agent_id: str | None = None,
        category: str | None = None,
        model: str | None = None,
    ) -> ResolvedPrompt | None:
        """Resolve only explicitly approved prompts with active versions.

        The static agent/system prompt authority is intentionally outside this
        function. Runtime candidates can supplement it but cannot replace it.
        """
        if scope not in _ALLOWED_SCOPES:
            raise PromptRegistryError(f"Unsupported prompt scope: {scope}")

        params: dict[str, str] = {
            "status": "eq.approved",
            "scope": f"eq.{scope}",
            "active_version_id": "not.is.null",
            "select": "id,slug,source,scope,active_version_id",
            "limit": "50",
        }
        if agent_id:
            params["agent_id"] = f"eq.{agent_id}"
        if category:
            params["category"] = f"eq.{category}"

        candidates = await self._request("GET", "prompt_registry", params=params) or []
        candidates.sort(key=lambda row: _SOURCE_PRIORITY.get(row["source"], 99))

        for candidate in candidates:
            versions = await self._request(
                "GET",
                "prompt_versions",
                params={
                    "id": f"eq.{candidate['active_version_id']}",
                    "select": (
                        "id,content,variables,checksum,risk_score,quality_score,"
                        "model_compatibility"
                    ),
                    "limit": "1",
                },
            )
            if not versions:
                continue
            version = versions[0]
            compatibility = tuple(version.get("model_compatibility") or ())
            if model and compatibility and model not in compatibility:
                continue
            return ResolvedPrompt(
                prompt_id=candidate["id"],
                version_id=version["id"],
                slug=candidate["slug"],
                source=candidate["source"],
                scope=candidate["scope"],
                content=version["content"],
                variables=version.get("variables") or {},
                checksum=version["checksum"],
                risk_score=float(version.get("risk_score") or 0),
                quality_score=(
                    float(version["quality_score"])
                    if version.get("quality_score") is not None
                    else None
                ),
                model_compatibility=compatibility,
            )
        return None

    async def record_evaluation(
        self,
        *,
        prompt_version_id: str,
        success: bool,
        agent_id: str | None = None,
        model: str | None = None,
        task_type: str | None = None,
        quality_score: float | None = None,
        latency_ms: int | None = None,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
        estimated_cost_usd: float | None = None,
        evaluator_notes: str | None = None,
        metadata: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        if quality_score is not None and not 0 <= quality_score <= 1:
            raise PromptRegistryError("quality_score must be between 0 and 1")
        rows = await self._request(
            "POST",
            "prompt_evaluations",
            json_body={
                "prompt_version_id": prompt_version_id,
                "agent_id": agent_id,
                "model": model,
                "task_type": task_type,
                "success": success,
                "quality_score": quality_score,
                "latency_ms": latency_ms,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "estimated_cost_usd": estimated_cost_usd,
                "evaluator_notes": evaluator_notes,
                "metadata": json.loads(json.dumps(dict(metadata or {}), default=str)),
            },
            prefer="return=representation",
        )
        if not rows:
            raise PromptRegistryError("Failed to record prompt evaluation")
        return rows[0]
