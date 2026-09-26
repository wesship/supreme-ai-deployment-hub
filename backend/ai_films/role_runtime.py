"""Fail-closed, version-pinned AI Films role profile reader for Hermes."""
from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Protocol


ROLE_TOOLS = {
    "teacher": {"lesson_search", "quiz_builder"},
    "instructor": {"manual_search", "progress_check"},
    "radio_dj": {"cleared_catalog", "station_schedule"},
    "host": {"script_library", "cue_sheet"},
    "support": {"product_faq", "create_handoff"},
}


class RoleProfileUnavailable(ValueError):
    """The requested role cannot be used; do not start the avatar session."""


class RoleStore(Protocol):
    async def _request(self, method: str, table: str, *, params: dict[str, str]) -> list[dict[str, Any]]: ...


def profile_hash(profile: dict[str, Any]) -> str:
    canonical = json.dumps(profile, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def validate_profile(role_id: str, profile: Any) -> dict[str, Any]:
    if role_id not in ROLE_TOOLS or not isinstance(profile, dict):
        raise RoleProfileUnavailable("Role is not available")
    expected = {"avatar_version", "voice_version", "introduction", "sources", "tools", "memory_scope", "handoff"}
    if set(profile) != expected:
        raise RoleProfileUnavailable("Profile fields are invalid")
    for field in ("avatar_version", "voice_version", "introduction", "handoff"):
        if not isinstance(profile[field], str) or not profile[field].strip():
            raise RoleProfileUnavailable("Profile text is incomplete")
    if (not isinstance(profile["sources"], list) or not profile["sources"]
            or any(not isinstance(s, str) or not re.fullmatch(r"[A-Za-z0-9:_./-]{1,160}", s) for s in profile["sources"])):
        raise RoleProfileUnavailable("Approved source IDs are required")
    tools = profile["tools"]
    if (not isinstance(tools, list) or any(not isinstance(t, str) for t in tools)
            or len(tools) != len(set(tools)) or not set(tools) <= ROLE_TOOLS[role_id]):
        raise RoleProfileUnavailable("Profile tool allowlist is invalid")
    if profile["memory_scope"] not in ("none", "session", "course"):
        raise RoleProfileUnavailable("Profile memory scope is invalid")
    if role_id == "radio_dj" and "cleared_catalog" not in tools:
        raise RoleProfileUnavailable("Radio DJ must use the cleared catalog")
    return profile


async def load_published_role(store: RoleStore, project_id: str, role_id: str,
                              *, character_id: str | None = None) -> dict[str, Any]:
    """Load the latest non-revoked release; session callers pin its version and hash."""
    if (not re.fullmatch(r"[0-9a-fA-F-]{36}", project_id) or role_id not in ROLE_TOOLS
            or (character_id is not None and not re.fullmatch(r"[0-9a-fA-F-]{36}", character_id))):
        raise RoleProfileUnavailable("Role is not available")
    if character_id is not None:
        identities = await store._request("GET", "ai_film_characters", params={
            "project_id": f"eq.{project_id}", "id": f"eq.{character_id}",
            "status": "eq.active", "select": "id", "limit": "1"})
        if len(identities) != 1:
            raise RoleProfileUnavailable("Active character is unavailable")
    rows = await store._request(
        "GET", "ai_film_character_role_releases" if character_id else "ai_film_role_releases",
        params={"project_id": f"eq.{project_id}", "role_id": f"eq.{role_id}",
                **({"character_id": f"eq.{character_id}"} if character_id else {}),
                "revoked_at": "is.null", "select": "version,profile,profile_hash",
                "order": "version.desc", "limit": "1"},
    )
    if len(rows) != 1:
        raise RoleProfileUnavailable("No released profile")
    row = rows[0]
    profile = validate_profile(role_id, row.get("profile"))
    version = row.get("version")
    digest = row.get("profile_hash")
    if type(version) is not int or version < 1 or not isinstance(digest, str) or profile_hash(profile) != digest:
        raise RoleProfileUnavailable("Released profile integrity check failed")
    return {"role_id": role_id, "character_id": character_id, "version": version,
            "profile_hash": digest, "profile": profile}
