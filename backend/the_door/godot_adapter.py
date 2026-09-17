"""Godot transport adapter for THE DOOR.

The adapter talks only to an operator-configured worker/editor bridge. Secrets stay
server-side. When the worker is unavailable or malformed, execution fails closed.
"""
from __future__ import annotations

import os
from urllib.parse import urlparse

import httpx

from backend.the_door.contracts import DoorJob, DoorJobState, GameProject, VerificationResult


class GodotDoorAdapter:
    def __init__(self) -> None:
        self._base_url = os.getenv("THE_DOOR_GODOT_TRANSPORT_URL", "").strip().rstrip("/")
        self._token = os.getenv("THE_DOOR_GODOT_TRANSPORT_TOKEN", "").strip()
        self._timeout = max(1.0, min(float(os.getenv("THE_DOOR_GODOT_TIMEOUT_SECONDS", "30")), 300.0))

    @property
    def name(self) -> str:
        return "godot"

    @property
    def configured(self) -> bool:
        return bool(self._base_url and self._token and self._valid_base_url(self._base_url))

    @staticmethod
    def _valid_base_url(value: str) -> bool:
        parsed = urlparse(value)
        return (
            parsed.scheme in {"http", "https"}
            and bool(parsed.hostname)
            and parsed.username is None
            and parsed.password is None
            and not parsed.query
            and not parsed.fragment
        )

    def _headers(self) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._token}",
        }

    def capabilities(self) -> dict[str, object]:
        return {
            "provider": self.name,
            "engine": "godot",
            "configured": self.configured,
            "mode": "http-worker-transport" if self.configured else "adapter-boundary",
            "transport_env": "THE_DOOR_GODOT_TRANSPORT_URL",
            "auth_env": "THE_DOOR_GODOT_TRANSPORT_TOKEN",
            "worker_contract": {
                "health": "GET /health",
                "execute": "POST /v1/jobs/execute",
                "verify": "POST /v1/jobs/verify",
            },
            "recommended_for": ["rapid prototypes", "2D/3D games", "XR", "agent-driven scene generation"],
        }

    async def health(self) -> dict[str, object]:
        if not self.configured:
            return {
                "configured": False,
                "reachable": False,
                "reason": "Godot transport URL and token are required.",
            }
        try:
            async with httpx.AsyncClient(timeout=self._timeout, follow_redirects=False) as client:
                response = await client.get(f"{self._base_url}/health", headers=self._headers())
                response.raise_for_status()
                payload = response.json()
            return {"configured": True, "reachable": True, "worker": payload}
        except (httpx.HTTPError, ValueError) as exc:
            return {"configured": True, "reachable": False, "reason": type(exc).__name__}

    async def execute(self, project: GameProject, job: DoorJob) -> DoorJob:
        if not self.configured:
            return self._blocked(job, "Godot transport URL and token are not configured.")
        payload = {"project": project.model_dump(mode="json"), "job": job.model_dump(mode="json")}
        try:
            async with httpx.AsyncClient(timeout=self._timeout, follow_redirects=False) as client:
                response = await client.post(
                    f"{self._base_url}/v1/jobs/execute",
                    headers=self._headers(),
                    json=payload,
                )
                response.raise_for_status()
                return DoorJob.model_validate(response.json())
        except (httpx.HTTPError, ValueError) as exc:
            return self._blocked(job, f"Godot worker execution failed: {type(exc).__name__}")

    async def verify(self, project: GameProject, job: DoorJob) -> VerificationResult:
        if not self.configured:
            return VerificationResult(
                passed=False,
                failures=["Godot transport URL and token are not configured."],
                observations={"provider": self.name, "engine": project.engine.value},
            )
        payload = {"project": project.model_dump(mode="json"), "job": job.model_dump(mode="json")}
        try:
            async with httpx.AsyncClient(timeout=self._timeout, follow_redirects=False) as client:
                response = await client.post(
                    f"{self._base_url}/v1/jobs/verify",
                    headers=self._headers(),
                    json=payload,
                )
                response.raise_for_status()
                return VerificationResult.model_validate(response.json())
        except (httpx.HTTPError, ValueError) as exc:
            return VerificationResult(
                passed=False,
                failures=[f"Godot worker verification failed: {type(exc).__name__}"],
                observations={"provider": self.name, "engine": project.engine.value},
            )

    def _blocked(self, job: DoorJob, reason: str) -> DoorJob:
        return job.model_copy(
            update={
                "state": DoorJobState.BLOCKED,
                "output": {**job.output, "reason": reason, "provider": self.name},
            }
        )
