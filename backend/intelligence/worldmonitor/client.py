from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import httpx


@dataclass(frozen=True)
class WorldMonitorConfig:
    mcp_url: str = "https://worldmonitor.app/mcp"
    api_key: str | None = None
    timeout_seconds: float = 25.0
    user_agent: str = "D3VONN-Intelligence/1.0 (+https://d3vonn.io)"

    @classmethod
    def from_env(cls) -> "WorldMonitorConfig":
        return cls(
            mcp_url=os.getenv("WORLDMONITOR_MCP_URL", "https://worldmonitor.app/mcp"),
            api_key=os.getenv("WORLDMONITOR_API_KEY") or None,
            timeout_seconds=float(os.getenv("WORLDMONITOR_TIMEOUT_SECONDS", "25")),
            user_agent=os.getenv(
                "WORLDMONITOR_USER_AGENT",
                "D3VONN-Intelligence/1.0 (+https://d3vonn.io)",
            ),
        )


class WorldMonitorClient:
    """Minimal MCP-over-HTTP client for World Monitor live intelligence tools."""

    def __init__(self, config: WorldMonitorConfig | None = None) -> None:
        self.config = config or WorldMonitorConfig.from_env()

    @property
    def configured(self) -> bool:
        return bool(self.config.api_key)

    def _headers(self) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "User-Agent": self.config.user_agent,
        }
        if self.config.api_key:
            headers["X-WorldMonitor-Key"] = self.config.api_key
        return headers

    async def _rpc(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
        }
        if params is not None:
            payload["params"] = params

        async with httpx.AsyncClient(
            timeout=self.config.timeout_seconds,
            follow_redirects=True,
        ) as client:
            response = await client.post(
                self.config.mcp_url,
                headers=self._headers(),
                json=payload,
            )
            response.raise_for_status()
            body = response.json()

        if "error" in body:
            raise RuntimeError(f"World Monitor MCP error: {body['error']}")
        return body.get("result", {})

    async def list_tools(self) -> dict[str, Any]:
        return await self._rpc("tools/list")

    async def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
        if not self.config.api_key:
            raise RuntimeError("WORLDMONITOR_API_KEY is not configured")
        return await self._rpc(
            "tools/call",
            {"name": name, "arguments": arguments or {}},
        )

    async def get_world_brief(self) -> dict[str, Any]:
        return await self.call_tool("get_world_brief")

    async def analyze_situation(
        self,
        query: str,
        *,
        context: str | None = None,
        framework: str | None = None,
    ) -> dict[str, Any]:
        arguments: dict[str, Any] = {"query": query}
        if context:
            arguments["context"] = context
        if framework:
            arguments["framework"] = framework
        return await self.call_tool("analyze_situation", arguments)
