"""Role draft transitions. Store RPC performs authorization and CAS atomically."""
from __future__ import annotations

from typing import Any, Protocol

from backend.ai_films.role_policy_attestation import verify_policy_attestation
from backend.ai_films.role_runtime import RoleProfileUnavailable, profile_hash, validate_profile


class AuthoringStore(Protocol):
    async def _request(self, method: str, table: str, *, params: dict[str, str]) -> list[dict[str, Any]]: ...
    async def role_rpc(self, payload: dict[str, Any]) -> dict[str, Any]: ...


class RoleAuthoring:
    def __init__(self, store: AuthoringStore):
        self.store = store

    async def _advance(self, action: str, project_id: str, role_id: str, actor_id: str,
                       revision: int, *, profile: dict | None = None,
                       digest: str | None = None, test_run_id: str | None = None,
                       character_id: str | None = None) -> dict:
        payload = {"p_action": action, "p_project_id": project_id,
                                          "p_role_id": role_id, "p_actor_id": actor_id,
                                          "p_expected_revision": revision, "p_profile": profile,
                                          "p_profile_hash": digest, "p_test_run_id": test_run_id}
        if character_id is not None:
            payload["p_character_id"] = character_id
        return await self.store.role_rpc(payload)

    async def save(self, project_id: str, role_id: str, actor_id: str,
                   expected_revision: int, profile: dict, *, character_id: str | None = None) -> dict:
        validate_profile(role_id, profile)
        return await self._advance("save", project_id, role_id, actor_id, expected_revision,
                                   profile=profile, digest=profile_hash(profile), character_id=character_id)

    async def mark_tested(self, project_id: str, role_id: str, actor_id: str,
                          revision: int, attestation: str, *, character_id: str | None = None) -> dict:
        if role_id not in {"teacher", "instructor", "radio_dj", "host", "support"}:
            raise RoleProfileUnavailable("Role is not available")
        rows = await self.store._request("GET", "ai_film_character_role_drafts" if character_id else "ai_film_role_drafts", params={
            "project_id": f"eq.{project_id}", "role_id": f"eq.{role_id}",
            **({"character_id": f"eq.{character_id}"} if character_id else {}),
            "select": "revision,profile,profile_hash,status", "limit": "1"})
        if len(rows) != 1 or rows[0].get("revision") != revision or rows[0].get("status") != "draft":
            raise RoleProfileUnavailable("Saved draft revision is unavailable")
        profile = validate_profile(role_id, rows[0].get("profile"))
        digest = profile_hash(profile)
        if digest != rows[0].get("profile_hash"):
            raise RoleProfileUnavailable("Saved draft hash is invalid")
        evidence = verify_policy_attestation(attestation, project_id, role_id, revision, profile,
                                             character_id=character_id)
        return await self._advance("test", project_id, role_id, actor_id, revision,
                                   digest=digest, test_run_id=evidence["nonce"], character_id=character_id)

    async def transition(self, action: str, project_id: str, role_id: str,
                         actor_id: str, revision: int, *, character_id: str | None = None) -> dict:
        if action not in {"submit", "approve", "publish"} or role_id not in {"teacher", "instructor", "radio_dj", "host", "support"}:
            raise RoleProfileUnavailable("Role transition is unavailable")
        return await self._advance(action, project_id, role_id, actor_id, revision, character_id=character_id)
