"""Server-authoritative Marketplace installation policy.

Pure validation helpers used by the authenticated FastAPI mutation boundary.
The browser may request an installation, but it cannot choose ownership,
runtime status, health, counters, or resource telemetry.
"""
from __future__ import annotations

import re
from typing import Any

from fastapi import HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

_ALLOWED_ENVIRONMENTS = {"development", "staging", "production"}
_ALLOWED_CAPABILITIES = {
    "hermes",
    "ffmpeg",
    "media-provider",
    "publish",
}
_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 _.-]{0,79}$")


class InstallationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agent_id: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=80)
    environment: str = "development"
    notifications: dict[str, Any] = Field(default_factory=dict)
    enabled_tools: list[str] = Field(default_factory=list, max_length=16)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not _NAME_RE.fullmatch(cleaned):
            raise ValueError("invalid installation name")
        return cleaned

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in _ALLOWED_ENVIRONMENTS:
            raise ValueError("invalid environment")
        return normalized

    @field_validator("enabled_tools")
    @classmethod
    def validate_tools(cls, value: list[str]) -> list[str]:
        normalized = list(dict.fromkeys(item.strip().lower() for item in value if item.strip()))
        unknown = sorted(set(normalized) - _ALLOWED_CAPABILITIES)
        if unknown:
            raise ValueError("unsupported capability request")
        return normalized

    @field_validator("notifications")
    @classmethod
    def validate_notifications(cls, value: dict[str, Any]) -> dict[str, Any]:
        if set(value) - {"email"}:
            raise ValueError("unsupported notification channel")
        email = value.get("email")
        if email is None:
            return {}
        if not isinstance(email, str) or len(email) > 254 or "@" not in email:
            raise ValueError("invalid notification email")
        return {"email": email.strip()}


def installation_row(*, user_id: str, request: InstallationRequest, registry_row: dict[str, Any]) -> dict[str, Any]:
    """Build the only client-requestable fields for a new deployment row."""
    registry_id = str(registry_row.get("id") or "")
    if not registry_id or str(registry_row.get("status") or "").lower() != "active":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Marketplace agent is not available")
    if registry_id != request.agent_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Marketplace registry identity mismatch")

    registry_caps = {str(item).strip().lower() for item in (registry_row.get("capabilities") or [])}
    if not set(request.enabled_tools).issubset(registry_caps | _ALLOWED_CAPABILITIES):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Capability request is not permitted")

    return {
        "user_id": user_id,
        "template_id": registry_id,
        "name": request.name,
        "config": {
            "environment": request.environment,
            "notifications": request.notifications,
        },
        "mcp_config": {"gateway_url": None, "enabled_tools": request.enabled_tools},
        "status": "starting",
    }
