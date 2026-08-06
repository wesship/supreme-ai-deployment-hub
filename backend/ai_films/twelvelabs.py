"""TwelveLabs/Jockey video intelligence adapter for AI Film Studio.

All credentials stay server-side. The adapter targets TwelveLabs API v1.3 and
supports the two operations D3VONN needs for film intelligence:
- direct knowledge-store search for ranked clips/images
- Jockey Responses for corpus-level reasoning and continuity analysis
"""

from __future__ import annotations

import os
from typing import Any, Mapping

import httpx


DEFAULT_API_BASE_URL = "https://api.twelvelabs.io/v1.3"
DEFAULT_JOCKEY_INSTRUCTIONS = (
    "You are the D3VONN.IO AI Film continuity and editorial intelligence agent. "
    "Ground conclusions in the configured knowledge store, preserve film canon, "
    "and cite concrete moments or time ranges when the source supports them."
)


class TwelveLabsError(RuntimeError):
    """Base error for TwelveLabs integration failures."""


class TwelveLabsConfigurationError(TwelveLabsError):
    """Raised when required server-side TwelveLabs configuration is missing."""


class TwelveLabsClient:
    def __init__(
        self,
        environ: Mapping[str, str] | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        source = environ or os.environ
        self.api_key = source.get("TWELVELABS_API_KEY", "").strip()
        self.knowledge_store_id = source.get("TWELVELABS_KNOWLEDGE_STORE_ID", "").strip()
        self.api_base_url = (
            source.get("TWELVELABS_API_BASE_URL", DEFAULT_API_BASE_URL).strip()
            or DEFAULT_API_BASE_URL
        ).rstrip("/")
        self._transport = transport

        missing = [
            name
            for name, value in (
                ("TWELVELABS_API_KEY", self.api_key),
                ("TWELVELABS_KNOWLEDGE_STORE_ID", self.knowledge_store_id),
            )
            if not value
        ]
        if missing:
            raise TwelveLabsConfigurationError(
                f"TwelveLabs is not configured; missing: {', '.join(missing)}"
            )

    async def _request(
        self,
        method: str,
        path: str,
        *,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(
                headers={
                    "x-api-key": self.api_key,
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                timeout=httpx.Timeout(45.0, connect=10.0),
                transport=self._transport,
            ) as client:
                url = f"{self.api_base_url}/{path.lstrip('/')}"
                response = await client.request(method, url, json=payload)
        except httpx.HTTPError as exc:
            raise TwelveLabsError("TwelveLabs request could not be completed") from exc

        if response.status_code >= 400:
            # Do not echo vendor bodies: they can contain submitted prompts/metadata.
            raise TwelveLabsError(
                f"TwelveLabs request failed with HTTP {response.status_code}"
            )
        try:
            result = response.json()
        except ValueError as exc:
            raise TwelveLabsError("TwelveLabs returned an invalid JSON response") from exc
        if not isinstance(result, dict):
            raise TwelveLabsError("TwelveLabs returned an unexpected response shape")
        return result

    async def retrieve_knowledge_store(self) -> dict[str, Any]:
        return await self._request(
            "GET", f"/knowledge-stores/{self.knowledge_store_id}"
        )

    async def search(
        self,
        query: str,
        *,
        page_size: int = 10,
        modalities: tuple[str, ...] = ("visual", "audio"),
        group_by: str = "none",
        include_metadata: bool = True,
    ) -> dict[str, Any]:
        return await self._request(
            "POST",
            f"/knowledge-stores/{self.knowledge_store_id}/search",
            payload={
                "query": {"text": query},
                "search_options": {"video": {"modalities": list(modalities)}},
                "group_by": group_by,
                "page_size": page_size,
                "include_metadata": include_metadata,
            },
        )

    async def reason(
        self,
        message: str,
        *,
        session_id: str | None = None,
        instructions: str | None = None,
        include_intermediate: bool = False,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "knowledge_store_id": self.knowledge_store_id,
            "input": [
                {
                    "type": "message",
                    "role": "user",
                    "content": message,
                }
            ],
            "stream": False,
            "instructions": instructions or DEFAULT_JOCKEY_INSTRUCTIONS,
        }
        if session_id:
            payload["session_id"] = session_id
        if include_intermediate:
            payload["include"] = ["intermediate_outputs"]

        return await self._request("POST", "/responses", payload=payload)
