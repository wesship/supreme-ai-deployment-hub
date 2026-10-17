"""Service-identity guard for HNF MCP integration.

This helper is not wired into the router until the compatibility and
authorization tests are reviewed. No user identity is inferred from an API key.
"""
from __future__ import annotations

from dataclasses import dataclass
import os
from typing import Mapping, Any


class MCPIdentityError(ValueError):
    """Unverified or conflicting MCP caller identity."""


@dataclass(frozen=True)
class MCPServiceIdentity:
    actor_id: str
    actor_type: str = "service"


def verify_mcp_service_identity(
    arguments: Mapping[str, Any],
    *,
    configured_actor_id: str | None = None,
) -> MCPServiceIdentity:
    """Resolve a service principal from trusted configuration, never tool args.

    An authenticated service credential is a prerequisite enforced by the
    calling route; this function does not authenticate that credential.
    """
    actor = (
        configured_actor_id
        if configured_actor_id is not None
        else os.getenv("HNF_MCP_SERVICE_ACTOR_ID", "")
    ).strip()
    if not actor:
        raise MCPIdentityError("MCP service principal is not configured")
    if "actor_id" in arguments and arguments["actor_id"] != actor:
        raise MCPIdentityError("Caller-supplied actor identity does not match service principal")
    if "actor_type" in arguments and arguments["actor_type"] != "service":
        raise MCPIdentityError("Service credential cannot assert user or agent identity")
    return MCPServiceIdentity(actor_id=actor)
