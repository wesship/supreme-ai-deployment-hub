"""Deterministic cache policy for D3VONN model/RAG workloads.

V1 defines cache eligibility, stable keys and TTLs without coupling callers to a
specific storage backend. Redis can implement this contract in the next rollout.
Sensitive, streaming, mutating, or explicitly non-cacheable work is never cached.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CachePolicy:
    name: str
    ttl_seconds: int
    enabled: bool = True


CACHE_POLICIES: dict[str, CachePolicy] = {
    "rag": CachePolicy(name="rag", ttl_seconds=300),
    "utility": CachePolicy(name="utility", ttl_seconds=300),
    "agent": CachePolicy(name="agent", ttl_seconds=60),
    "interactive": CachePolicy(name="interactive", ttl_seconds=0, enabled=False),
}


def cache_key(namespace: str, payload: dict[str, Any]) -> str:
    """Return a stable, non-reversible key for a normalized request payload."""
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return f"d3vonn:{namespace}:{digest}"


def cache_policy(name: str) -> CachePolicy:
    return CACHE_POLICIES.get(name, CACHE_POLICIES["interactive"])


def is_cacheable(
    *,
    policy_name: str,
    streaming: bool = False,
    mutating: bool = False,
    sensitive: bool = False,
    explicitly_disabled: bool = False,
) -> bool:
    """Fail closed: cache only stable read-only workloads allowed by policy."""
    policy = cache_policy(policy_name)
    return bool(
        policy.enabled
        and policy.ttl_seconds > 0
        and not streaming
        and not mutating
        and not sensitive
        and not explicitly_disabled
    )
