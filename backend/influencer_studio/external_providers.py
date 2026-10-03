from __future__ import annotations

import json
import os
from typing import Any
from uuid import uuid4

import httpx

from .providers import MediaCapability, MediaJob, MediaProvider, MediaRequest


def _parse_mcp_response(response: httpx.Response) -> dict[str, Any]:
    response.raise_for_status()
    content_type = response.headers.get("content-type", "")
    if "text/event-stream" in content_type:
        for line in response.text.splitlines():
            if line.startswith("data:"):
                payload = line.removeprefix("data:").strip()
                if payload and payload != "[DONE]":
                    decoded = json.loads(payload)
                    if isinstance(decoded, dict):
                        return decoded
        raise RuntimeError("MCP server returned no JSON event")
    decoded = response.json()
    if not isinstance(decoded, dict):
        raise RuntimeError("MCP server returned a non-object response")
    return decoded


class EromifyMCPProvider(MediaProvider):
    """Remote MCP adapter for Eromify.

    The current Eromify MCP endpoint supports OAuth in interactive clients and
    personal Bearer keys for scripts. D3VONN uses the latter through a server-side
    secret. Tool names/schemas are discovered at runtime instead of being hard-coded.
    """

    name = "eromify"
    capabilities = frozenset(
        {
            MediaCapability.TEXT_TO_IMAGE,
            MediaCapability.IMAGE_TO_IMAGE,
            MediaCapability.TEXT_TO_VIDEO,
            MediaCapability.IMAGE_TO_VIDEO,
            MediaCapability.MOTION_TRANSFER,
            MediaCapability.UPSCALE,
            MediaCapability.IDENTITY_PRESERVATION,
        }
    )

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = "https://api.eromify.in/mcp",
        client: httpx.AsyncClient | None = None,
    ) -> None:
        if not api_key.strip():
            raise ValueError("Eromify personal API key is required")
        self.base_url = base_url
        self._api_key = api_key
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(timeout=httpx.Timeout(120.0))
        self._request_id = 0
        self._initialized = False
        self._tools: list[dict[str, Any]] | None = None

    @classmethod
    def from_env(cls, **kwargs: Any) -> "EromifyMCPProvider":
        return cls(
            api_key=os.getenv("EROMIFY_API_KEY", ""),
            base_url=os.getenv("EROMIFY_MCP_URL", "https://api.eromify.in/mcp"),
            **kwargs,
        )

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def _rpc(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        self._request_id += 1
        response = await self._client.post(
            self.base_url,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Accept": "application/json, text/event-stream",
                "Content-Type": "application/json",
            },
            json={
                "jsonrpc": "2.0",
                "id": self._request_id,
                "method": method,
                "params": params or {},
            },
        )
        decoded = _parse_mcp_response(response)
        if decoded.get("error"):
            raise RuntimeError(f"Eromify MCP error: {decoded['error']}")
        return decoded

    async def initialize(self) -> None:
        if self._initialized:
            return
        await self._rpc(
            "initialize",
            {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "d3vonn-influencer-studio", "version": "1.0"},
            },
        )
        self._initialized = True

    async def list_tools(self, *, refresh: bool = False) -> list[dict[str, Any]]:
        await self.initialize()
        if self._tools is None or refresh:
            result = await self._rpc("tools/list")
            payload = result.get("result") or {}
            tools = payload.get("tools") if isinstance(payload, dict) else None
            if not isinstance(tools, list):
                raise RuntimeError("Eromify MCP tools/list returned no tools")
            self._tools = [tool for tool in tools if isinstance(tool, dict)]
        return list(self._tools)

    @staticmethod
    def _capability_terms(capability: MediaCapability) -> tuple[str, ...]:
        return {
            MediaCapability.TEXT_TO_IMAGE: ("image", "generate"),
            MediaCapability.IMAGE_TO_IMAGE: ("image", "edit"),
            MediaCapability.TEXT_TO_VIDEO: ("video", "generate"),
            MediaCapability.IMAGE_TO_VIDEO: ("video", "image"),
            MediaCapability.MOTION_TRANSFER: ("motion", "video"),
            MediaCapability.UPSCALE: ("upscale",),
            MediaCapability.IDENTITY_PRESERVATION: ("character",),
        }[capability]

    async def _select_tool(self, request: MediaRequest) -> dict[str, Any]:
        explicit = str(request.options.get("tool_name") or "").strip()
        tools = await self.list_tools()
        if explicit:
            for tool in tools:
                if tool.get("name") == explicit:
                    return tool
            raise ValueError(f"Eromify MCP tool not found: {explicit}")

        terms = self._capability_terms(request.capability)
        scored: list[tuple[int, dict[str, Any]]] = []
        for tool in tools:
            haystack = f"{tool.get('name', '')} {tool.get('description', '')}".lower()
            score = sum(1 for term in terms if term in haystack)
            if score:
                scored.append((score, tool))
        if not scored:
            raise RuntimeError(
                f"No Eromify MCP tool discovered for capability {request.capability.value}; "
                "supply options.tool_name after inspecting tools/list"
            )
        scored.sort(key=lambda pair: pair[0], reverse=True)
        return scored[0][1]

    @staticmethod
    def _arguments_for_tool(tool: dict[str, Any], request: MediaRequest) -> dict[str, Any]:
        raw: dict[str, Any] = {
            "prompt": request.prompt,
            "persona_id": request.persona_id,
            "reference_assets": list(request.reference_assets),
            **{k: v for k, v in request.options.items() if k not in {"tool_name", "arguments"}},
        }
        explicit = request.options.get("arguments")
        if isinstance(explicit, dict):
            raw.update(explicit)

        schema = tool.get("inputSchema")
        properties = schema.get("properties") if isinstance(schema, dict) else None
        if isinstance(properties, dict) and properties:
            return {key: value for key, value in raw.items() if key in properties}
        return raw

    async def submit(self, request: MediaRequest) -> MediaJob:
        tool = await self._select_tool(request)
        tool_name = str(tool.get("name") or "")
        if not tool_name:
            raise RuntimeError("Eromify MCP tool has no name")
        arguments = self._arguments_for_tool(tool, request)
        response = await self._rpc(
            "tools/call",
            {"name": tool_name, "arguments": arguments},
        )
        result = response.get("result")
        structured = result.get("structuredContent") if isinstance(result, dict) else None
        data = structured if isinstance(structured, dict) else {}
        external_id = str(
            data.get("job_id")
            or data.get("generation_id")
            or data.get("id")
            or uuid4()
        )
        return MediaJob(
            provider=self.name,
            external_job_id=external_id,
            status=str(data.get("status") or "submitted"),
            provenance={
                "transport": "mcp",
                "server": self.base_url,
                "tool": tool_name,
                "result": result if isinstance(result, dict) else {},
            },
        )

    async def get_job(self, external_job_id: str) -> MediaJob:
        return MediaJob(
            provider=self.name,
            external_job_id=external_job_id,
            status="unknown",
            provenance={
                "transport": "mcp",
                "server": self.base_url,
                "note": "Use Eromify generation history tool through tools/list for provider-specific refresh.",
            },
        )


class ComfyUIWanProvider(MediaProvider):
    """Self-hosted ComfyUI execution adapter suitable for Wan API-format workflows."""

    name = "comfyui-wan"
    capabilities = frozenset(
        {
            MediaCapability.TEXT_TO_IMAGE,
            MediaCapability.IMAGE_TO_IMAGE,
            MediaCapability.TEXT_TO_VIDEO,
            MediaCapability.IMAGE_TO_VIDEO,
            MediaCapability.MOTION_TRANSFER,
            MediaCapability.UPSCALE,
            MediaCapability.IDENTITY_PRESERVATION,
        }
    )

    def __init__(
        self,
        *,
        base_url: str,
        client: httpx.AsyncClient | None = None,
        bearer_token: str | None = None,
    ) -> None:
        if not base_url.strip():
            raise ValueError("ComfyUI base URL is required")
        self.base_url = base_url.rstrip("/")
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(timeout=httpx.Timeout(120.0))
        self._bearer_token = bearer_token

    @classmethod
    def from_env(cls, **kwargs: Any) -> "ComfyUIWanProvider":
        return cls(
            base_url=os.getenv("COMFYUI_BASE_URL", ""),
            bearer_token=os.getenv("COMFYUI_BEARER_TOKEN") or None,
            **kwargs,
        )

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    @property
    def _headers(self) -> dict[str, str]:
        if not self._bearer_token:
            return {}
        return {"Authorization": f"Bearer {self._bearer_token}"}

    async def probe(self) -> dict[str, Any]:
        response = await self._client.get(f"{self.base_url}/system_stats", headers=self._headers)
        response.raise_for_status()
        data = response.json()
        return data if isinstance(data, dict) else {"status": "reachable"}

    async def submit(self, request: MediaRequest) -> MediaJob:
        workflow = request.options.get("workflow")
        if not isinstance(workflow, dict) or not workflow:
            raise ValueError(
                "ComfyUI submission requires options.workflow in API-format JSON; "
                "D3VONN does not guess model-specific node graphs"
            )
        client_id = str(request.options.get("client_id") or f"d3vonn-{request.persona_id}")
        response = await self._client.post(
            f"{self.base_url}/prompt",
            headers={**self._headers, "Content-Type": "application/json"},
            json={"prompt": workflow, "client_id": client_id},
        )
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict) or not data.get("prompt_id"):
            raise RuntimeError("ComfyUI did not return prompt_id")
        return MediaJob(
            provider=self.name,
            external_job_id=str(data["prompt_id"]),
            status="queued",
            provenance={
                "engine": "comfyui",
                "model_family": str(request.options.get("model_family") or "wan"),
                "node_errors": data.get("node_errors") or {},
            },
        )

    async def get_job(self, external_job_id: str) -> MediaJob:
        response = await self._client.get(
            f"{self.base_url}/history/{external_job_id}",
            headers=self._headers,
        )
        response.raise_for_status()
        data = response.json()
        history = data.get(external_job_id) if isinstance(data, dict) else None
        if not isinstance(history, dict):
            status = "running"
            provenance: dict[str, Any] = {}
        else:
            status_block = history.get("status")
            completed = bool(status_block.get("completed")) if isinstance(status_block, dict) else False
            status = "succeeded" if completed else "running"
            provenance = {"history": history}
        return MediaJob(
            provider=self.name,
            external_job_id=external_job_id,
            status=status,
            provenance=provenance,
        )


def configured_provider_health(environ: dict[str, str] | None = None) -> dict[str, Any]:
    source = environ or dict(os.environ)
    eromify_key = bool(source.get("EROMIFY_API_KEY", "").strip())
    comfy_url = bool(source.get("COMFYUI_BASE_URL", "").strip())
    return {
        "providers": [
            {
                "provider": "eromify",
                "configured": eromify_key,
                "transport": "mcp",
                "endpoint": source.get("EROMIFY_MCP_URL", "https://api.eromify.in/mcp"),
                "requires": ["EROMIFY_API_KEY"],
            },
            {
                "provider": "comfyui-wan",
                "configured": comfy_url,
                "transport": "http",
                "endpoint": source.get("COMFYUI_BASE_URL") or None,
                "requires": ["COMFYUI_BASE_URL"],
            },
        ]
    }
