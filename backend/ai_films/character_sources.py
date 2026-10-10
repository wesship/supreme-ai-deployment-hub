"""Exact, project-scoped source snapshots for published character roles."""
from __future__ import annotations

import hashlib
import re
from typing import Any, Protocol
from uuid import UUID

from backend.ai_films.role_runtime import RoleProfileUnavailable


class SourceUnavailable(ValueError):
    """A release has no complete set of intact, approved source snapshots."""


class SourceStore(Protocol):
    async def _request(self, method: str, table: str, *, params: dict[str, str]) -> list[dict[str, Any]]: ...


def source_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _source_ids(profile: dict[str, Any]) -> list[str]:
    ids = profile.get("sources")
    if not isinstance(ids, list) or not 1 <= len(ids) <= 20 or len(ids) != len(set(ids)):
        raise SourceUnavailable("Release source IDs are incomplete")
    try:
        if any(str(UUID(value)) != value for value in ids):
            raise ValueError("Noncanonical source ID")
    except (ValueError, TypeError, AttributeError) as exc:
        raise SourceUnavailable("Release contains an invalid source ID") from exc
    return ids


async def load_approved_sources(store: SourceStore, project_id: str,
                                release: dict[str, Any]) -> list[dict[str, Any]]:
    """Fail closed when any release source is missing, revoked, or mutated."""
    if not release.get("character_id") or not release.get("profile_hash"):
        raise RoleProfileUnavailable("A pinned character release is required")
    ids = _source_ids(release["profile"])
    rows = await store._request("GET", "ai_film_character_sources", params={
        "project_id": f"eq.{project_id}", "id": f"in.({','.join(ids)})",
        "status": "eq.approved",
        "select": "id,title,content,content_hash,rights_basis,approved_by",
        "limit": "21",
    })
    by_id = {row.get("id"): row for row in rows}
    if len(rows) != len(ids) or len(by_id) != len(ids):
        raise SourceUnavailable("Released source set is unavailable")
    for source_id in ids:
        row = by_id.get(source_id)
        if (not row or not isinstance(row.get("content"), str)
                or not isinstance(row.get("content_hash"), str)
                or not isinstance(row.get("approved_by"), str)
                or source_hash(row["content"]) != row["content_hash"]):
            raise SourceUnavailable("Released source integrity check failed")
    return [by_id[source_id] for source_id in ids]


def search_sources(sources: list[dict[str, Any]], question: str) -> list[dict[str, str]]:
    """Small, deterministic excerpt selector. No generative answer is implied."""
    common = {"the", "and", "for", "from", "with", "what", "how", "why", "when",
              "where", "are", "does", "did", "can", "this", "that", "into"}
    terms = set(re.findall(r"[a-z0-9]{3,}", question.lower())) - common
    if not terms or len(question) > 500:
        raise ValueError("A specific question of at most 500 characters is required")
    ranked: list[tuple[int, str, dict[str, Any]]] = []
    for source in sources:
        # Excerpts preserve original text and carry the immutable source digest.
        for chunk in re.split(r"(?<=[.!?])\s+|\n{2,}", source["content"]):
            chunk = chunk.strip()
            if not chunk:
                continue
            words = set(re.findall(r"[a-z0-9]{3,}", chunk.lower()))
            score = len(terms & words)
            if score:
                ranked.append((score, source["id"], {**source, "excerpt": chunk[:700]}))
    ranked.sort(key=lambda match: (-match[0], match[1], match[2]["excerpt"]))
    return [{"source_id": row["id"], "title": row["title"],
             "source_hash": row["content_hash"], "excerpt": row["excerpt"]}
            for _, _, row in ranked[:5]]
