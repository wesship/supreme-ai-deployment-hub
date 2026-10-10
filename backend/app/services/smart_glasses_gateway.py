"""Fail-closed smart-glasses gateway policy.

This module validates an already-authenticated device envelope and returns a routing
decision. It does not execute device actions or backend tools.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

LOW_RISK_ACTIONS = {"get_battery", "capture_photo", "describe_scene", "read_text", "create_note", "ask_d3vonn", "recall_memory"}
GUARDIAN_ACTIONS = {"start_recording", "stop_recording", "get_location", "delete_data", "send_money"}


class NonceStore(Protocol):
    async def reserve(self, device_id: str, nonce: str, ttl_seconds: int) -> bool: ...


class DeviceRegistry(Protocol):
    async def is_active(self, device_id: str) -> bool: ...


class KillSwitch(Protocol):
    async def enabled(self) -> bool: ...


@dataclass(frozen=True)
class GatewayDecision:
    route: str
    reason: str
    correlation_id: str
    action: str | None = None


async def authorize_request(
    *,
    device_id: str,
    nonce: str,
    correlation_id: str,
    proposal: dict[str, Any],
    nonce_store: NonceStore,
    device_registry: DeviceRegistry,
    kill_switch: KillSwitch,
    nonce_ttl_seconds: int = 300,
) -> GatewayDecision:
    """Authorize only routing, never execution.

    The signed-envelope cryptographic verification belongs at ingress. This function
    enforces revocation, replay prevention, kill-switch state, and approval class.
    """
    if not device_id or not nonce or not correlation_id:
        return GatewayDecision("deny", "missing_request_identity", correlation_id or "")
    if await kill_switch.enabled():
        return GatewayDecision("deny", "global_kill_switch", correlation_id)
    if not await device_registry.is_active(device_id):
        return GatewayDecision("deny", "device_revoked_or_unknown", correlation_id)
    if not await nonce_store.reserve(device_id, nonce, nonce_ttl_seconds):
        return GatewayDecision("deny", "replay_detected", correlation_id)

    route = proposal.get("route")
    call = proposal.get("call") if isinstance(proposal.get("call"), dict) else None
    action = call.get("name") if call else None

    if route == "escalate":
        return GatewayDecision("deny", "proposal_escalated", correlation_id, action)
    if route == "guardian_review" or action in GUARDIAN_ACTIONS:
        return GatewayDecision("guardian_review", "human_approval_required", correlation_id, action)
    if route in {"local", "d3vonn_gateway"} and action in LOW_RISK_ACTIONS:
        return GatewayDecision("approved_route", "policy_allowed_low_risk", correlation_id, action)
    return GatewayDecision("deny", "unknown_or_unapproved_action", correlation_id, action)


class RedisNonceStore:
    """Redis-backed replay guard using atomic SET NX EX semantics."""

    def __init__(self, redis_client: Any, *, prefix: str = "smartglasses:nonce") -> None:
        self.redis = redis_client
        self.prefix = prefix

    async def reserve(self, device_id: str, nonce: str, ttl_seconds: int) -> bool:
        key = f"{self.prefix}:{device_id}:{nonce}"
        result = await self.redis.set(key, "1", ex=ttl_seconds, nx=True)
        return bool(result)
