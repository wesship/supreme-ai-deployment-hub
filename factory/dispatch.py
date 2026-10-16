"""Pure Hermes factory dispatch planner. Does not start workers or mutate storage."""
from __future__ import annotations

from dataclasses import dataclass
from collections.abc import Callable, Mapping
from datetime import datetime
from hashlib import sha256
from typing import Any

from factory.approval_binding import authorize_dispatch
from factory.safety import FactorySafetyError, dependency_order


@dataclass(frozen=True)
class DispatchPlan:
    task_id: str
    issue_id: str
    repository: str
    commit_sha: str
    operation: str
    required_capability: str = "software-factory-builder"


def plan_dispatch(
    *,
    issue_id: str,
    repository: str,
    commit_sha: str,
    operation: str,
    approval: Mapping[str, object],
    trusted_verifier: Callable[[Mapping[str, object]], bool],
    dependency_graph: Mapping[str, list[str]],
    completed_issues: frozenset[str],
    now: datetime | None = None,
) -> DispatchPlan:
    """Validate scope and dependencies before producing a deterministic task key.

    This function is not a substitute for the persistent Hermes lease registry.
    The runtime adapter must acquire a unique lease transactionally and reconcile
    prior tasks before any worker side effects occur.
    """
    if not all(isinstance(value, str) and value.strip() for value in
               (issue_id, repository, commit_sha, operation)):
        raise FactorySafetyError("invalid task scope")
    if issue_id not in dependency_graph:
        raise FactorySafetyError("issue not in dependency graph")
    dependency_order(dependency_graph)
    if not isinstance(completed_issues, frozenset):
        raise FactorySafetyError("completed issues must be a frozen set")
    if not all(isinstance(item, str) for item in completed_issues):
        raise FactorySafetyError("invalid completed issue")
    if not set(dependency_graph[issue_id]).issubset(completed_issues):
        raise FactorySafetyError("unmet dependencies")
    authorize_dispatch(
        approval, issue_id=issue_id, repository=repository,
        commit_sha=commit_sha, operation=operation,
        trusted_verifier=trusted_verifier, now=now,
    )
    # Length-delimited canonical encoding prevents concatenation collisions.
    parts = (repository, issue_id, commit_sha, operation)
    encoded = "".join(f"{len(part)}:{part}" for part in parts).encode()
    task_id = "factory-" + sha256(encoded).hexdigest()[:32]
    return DispatchPlan(task_id, issue_id, repository, commit_sha, operation)
