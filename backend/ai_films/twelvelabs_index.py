"""TwelveLabs v1.3 index-search adapter for D3VONN.IO AI Films.

This module is additive to the knowledge-store/Jockey client. It targets the
canonical Playground index that has been validated interactively in TwelveLabs.
"""
from __future__ import annotations

import os
from typing import Any, Mapping

import httpx

from backend.ai_films.twelvelabs import TwelveLabsError

DEFAULT_API_BASE_URL = "https://api.twelvelabs.io/v1.3"
DEFAULT_AI_FILMS_INDEX_ID = "6a7419fa2e85d14a80dcd2ac"


class TwelveLabsIndexClient:
    def __init__(
        self,
        environ: Mapping[str, str] | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        source = environ or os.environ
        self.api_key = source.get("TWELVELABS_API_KEY", "").strip()
        self.index_id = (
            source.get("TWELVELABS_INDEX_ID", DEFAULT_AI_FILMS_INDEX_ID).strip()
            or DEFAULT_AI_FILMS_INDEX_ID
        )
        self.api_base_url = (
            source.get("TWELVELABS_API_BASE_URL", DEFAULT_API_BASE_URL).strip()
            or DEFAULT_API_BASE_URL
        ).rstrip("/")
        self._transport = transport
        if not self.api_key:
            raise TwelveLabsError("TwelveLabs index search is not configured; missing TWELVELABS_API_KEY")

    async def retrieve_index(self) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(
                headers={"x-api-key": self.api_key, "Accept": "application/json"},
                timeout=httpx.Timeout(45.0, connect=10.0),
                transport=self._transport,
            ) as client:
                response = await client.get(f"{self.api_base_url}/indexes/{self.index_id}")
        except httpx.HTTPError as exc:
            raise TwelveLabsError("TwelveLabs index status could not be completed") from exc
        if response.status_code >= 400:
            raise TwelveLabsError(f"TwelveLabs index status failed with HTTP {response.status_code}")
        result = response.json()
        if not isinstance(result, dict):
            raise TwelveLabsError("TwelveLabs returned an unexpected index status response")
        return result

    async def search(
        self,
        query: str,
        *,
        page_limit: int = 10,
        search_options: tuple[str, ...] = ("visual", "audio", "transcription"),
        transcription_options: tuple[str, ...] = ("lexical", "semantic"),
        group_by: str = "clip",
        operator: str = "or",
        include_user_metadata: bool = True,
    ) -> dict[str, Any]:
        fields: list[tuple[str, tuple[None, str]]] = [
            ("query_text", (None, query)),
            ("index_id", (None, self.index_id)),
            ("group_by", (None, group_by)),
            ("operator", (None, operator)),
            ("page_limit", (None, str(page_limit))),
            ("include_user_metadata", (None, "true" if include_user_metadata else "false")),
        ]
        fields.extend(("search_options", (None, option)) for option in search_options)
        if "transcription" in search_options:
            fields.extend(
                ("transcription_options", (None, option))
                for option in transcription_options
            )
        try:
            async with httpx.AsyncClient(
                headers={"x-api-key": self.api_key, "Accept": "application/json"},
                timeout=httpx.Timeout(45.0, connect=10.0),
                transport=self._transport,
            ) as client:
                response = await client.post(f"{self.api_base_url}/search", files=fields)
        except httpx.HTTPError as exc:
            raise TwelveLabsError("TwelveLabs index search could not be completed") from exc
        if response.status_code >= 400:
            raise TwelveLabsError(f"TwelveLabs index search failed with HTTP {response.status_code}")
        result = response.json()
        if not isinstance(result, dict):
            raise TwelveLabsError("TwelveLabs returned an unexpected index search response")
        return result
