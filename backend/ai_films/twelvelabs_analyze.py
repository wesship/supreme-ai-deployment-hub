"""TwelveLabs v1.3 Analyze adapter for D3VONN.IO AI Films."""
from __future__ import annotations

import os
from typing import Any, Mapping

import httpx

from backend.ai_films.twelvelabs import TwelveLabsError

DEFAULT_API_BASE_URL = "https://api.twelvelabs.io/v1.3"


class TwelveLabsAnalyzeClient:
    """Analyze an existing TwelveLabs asset with Pegasus without re-uploading media."""

    def __init__(
        self,
        environ: Mapping[str, str] | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        source = environ or os.environ
        self.api_key = source.get("TWELVELABS_API_KEY", "").strip()
        self.api_base_url = (
            source.get("TWELVELABS_API_BASE_URL", DEFAULT_API_BASE_URL).strip()
            or DEFAULT_API_BASE_URL
        ).rstrip("/")
        self._transport = transport
        if not self.api_key:
            raise TwelveLabsError("TwelveLabs Analyze is not configured; missing TWELVELABS_API_KEY")

    async def analyze_asset(
        self,
        asset_id: str,
        prompt: str,
        *,
        model_name: str = "pegasus1.5",
        temperature: float = 0.2,
        max_tokens: int = 4096,
        start_time: float | None = None,
        end_time: float | None = None,
    ) -> dict[str, Any]:
        if not asset_id.strip():
            raise TwelveLabsError("An asset_id is required for TwelveLabs Analyze")
        if not prompt.strip():
            raise TwelveLabsError("A prompt is required for TwelveLabs Analyze")
        if model_name not in {"pegasus1.2", "pegasus1.5"}:
            raise TwelveLabsError("Unsupported TwelveLabs Analyze model")

        payload: dict[str, Any] = {
            "model_name": model_name,
            "video": {"type": "asset_id", "asset_id": asset_id.strip()},
            "prompt": prompt.strip(),
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }
        if start_time is not None:
            payload["start_time"] = start_time
        if end_time is not None:
            payload["end_time"] = end_time

        try:
            async with httpx.AsyncClient(
                headers={
                    "x-api-key": self.api_key,
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                timeout=httpx.Timeout(120.0, connect=10.0),
                transport=self._transport,
            ) as client:
                response = await client.post(f"{self.api_base_url}/analyze", json=payload)
        except httpx.HTTPError as exc:
            raise TwelveLabsError("TwelveLabs Analyze request could not be completed") from exc

        if response.status_code >= 400:
            raise TwelveLabsError(
                f"TwelveLabs Analyze failed with HTTP {response.status_code}"
            )

        result = response.json()
        if not isinstance(result, dict):
            raise TwelveLabsError("TwelveLabs returned an unexpected Analyze response")
        return result
