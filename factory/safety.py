"""Pure, fail-closed pre-dispatch checks. No network or execution side effects."""
from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timezone


class FactorySafetyError(ValueError):
    """An issue is not authorized or its dependency graph is invalid."""


def require_approval(record: Mapping[str, object], *, issue_id: str, now: datetime | None = None) -> None:
    """Require an exact, unexpired, human approval bound to the current issue."""
    if not isinstance(record, Mapping):
        raise FactorySafetyError("missing approval")
    if record.get("decision") != "approved":
        raise FactorySafetyError("approval denied or absent")
    if record.get("issue_id") != issue_id:
        raise FactorySafetyError("approval issue mismatch")
    actor = record.get("actor")
    if not isinstance(actor, str) or not actor.strip() or actor.startswith("agent:"):
        raise FactorySafetyError("human approver required")
    expiry = record.get("expires_at")
    if not isinstance(expiry, str):
        raise FactorySafetyError("approval expiry missing")
    try:
        parsed = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
    except ValueError as exc:
        raise FactorySafetyError("invalid approval expiry") from exc
    if parsed.tzinfo is None:
        raise FactorySafetyError("timezone-aware expiry required")
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        raise FactorySafetyError("timezone-aware clock required")
    if parsed <= current:
        raise FactorySafetyError("approval expired")


def dependency_order(graph: Mapping[str, list[str]]) -> list[str]:
    """Return a deterministic dependency-first order, rejecting unknowns and cycles."""
    if not isinstance(graph, Mapping):
        raise FactorySafetyError("invalid dependency graph")
    for name, dependencies in graph.items():
        if not isinstance(name, str) or not name or not isinstance(dependencies, list):
            raise FactorySafetyError("invalid graph entry")
        if any(not isinstance(dep, str) or dep not in graph for dep in dependencies):
            raise FactorySafetyError(f"unknown dependency for {name}")
    active: set[str] = set()
    visited: set[str] = set()
    result: list[str] = []

    def visit(name: str) -> None:
        if name in active:
            raise FactorySafetyError("dependency cycle")
        if name in visited:
            return
        active.add(name)
        for dependency in sorted(graph[name]):
            visit(dependency)
        active.remove(name)
        visited.add(name)
        result.append(name)

    for node in sorted(graph):
        visit(node)
    return result
