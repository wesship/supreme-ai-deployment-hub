"""D3VONN Token Governor v1.

Central, provider-agnostic token budgeting for model calls.

Goals:
- keep the server authoritative over output-token limits;
- estimate prompt size without adding a tokenizer dependency;
- preserve system instructions and newest conversational context;
- trim only when a request exceeds the configured prompt budget;
- emit structured metadata for cost/usage telemetry.

This module intentionally does not summarize user content with another model.  V1
uses deterministic trimming so token savings never create hidden extra model calls.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable


# Conservative approximation that works across common BPE tokenizers for budget
# enforcement. Real provider usage should still be recorded from API responses.
_CHARS_PER_TOKEN = 4


@dataclass(frozen=True)
class TokenPolicy:
    name: str
    max_prompt_tokens: int
    default_output_tokens: int
    max_output_tokens: int
    reserve_tokens: int = 256


@dataclass(frozen=True)
class TokenDecision:
    policy: str
    estimated_prompt_tokens_before: int
    estimated_prompt_tokens_after: int
    requested_output_tokens: int
    allowed_output_tokens: int
    messages_before: int
    messages_after: int
    trimmed: bool


POLICIES: dict[str, TokenPolicy] = {
    # Website chat and ordinary interactive work.
    "interactive": TokenPolicy(
        name="interactive",
        max_prompt_tokens=12_000,
        default_output_tokens=2_048,
        max_output_tokens=4_096,
    ),
    # Multi-step Hermes planning / orchestration.
    "agent": TokenPolicy(
        name="agent",
        max_prompt_tokens=24_000,
        default_output_tokens=4_096,
        max_output_tokens=8_192,
    ),
    # Deliberately small budget for classification/extraction/tool routing.
    "utility": TokenPolicy(
        name="utility",
        max_prompt_tokens=8_000,
        default_output_tokens=768,
        max_output_tokens=1_536,
    ),
}


def estimate_tokens(text: str) -> int:
    """Return a cheap, conservative token estimate for policy enforcement."""
    if not text:
        return 0
    return max(1, (len(text) + _CHARS_PER_TOKEN - 1) // _CHARS_PER_TOKEN)


def estimate_message_tokens(messages: Iterable[dict[str, Any]]) -> int:
    """Estimate message tokens including a small role/framing overhead."""
    total = 0
    for message in messages:
        total += 6  # role + message framing approximation
        total += estimate_tokens(str(message.get("content", "")))
    return total


def _trim_messages(
    messages: list[dict[str, Any]],
    max_prompt_tokens: int,
) -> list[dict[str, Any]]:
    """Preserve system messages and newest turns while dropping oldest history.

    If system messages alone plus the newest message exceed the budget, their
    content is not silently truncated. The caller can reject or route the request
    to a larger-context policy instead of damaging instructions.
    """
    if estimate_message_tokens(messages) <= max_prompt_tokens:
        return messages

    system_messages = [m for m in messages if m.get("role") == "system"]
    conversational = [m for m in messages if m.get("role") != "system"]

    kept: list[dict[str, Any]] = list(system_messages)
    used = estimate_message_tokens(kept)

    # Keep newest context first, then restore chronological order.
    newest_kept: list[dict[str, Any]] = []
    for message in reversed(conversational):
        cost = estimate_message_tokens([message])
        if used + cost > max_prompt_tokens:
            continue
        newest_kept.append(message)
        used += cost

    newest_kept.reverse()
    return kept + newest_kept


def govern_chat_request(
    messages: list[dict[str, Any]],
    requested_output_tokens: int | None,
    *,
    policy_name: str = "interactive",
) -> tuple[list[dict[str, Any]], TokenDecision]:
    """Apply a token policy to a chat request.

    The browser/client may ask for a budget, but the governor owns the final cap.
    """
    policy = POLICIES.get(policy_name, POLICIES["interactive"])
    requested = requested_output_tokens or policy.default_output_tokens
    allowed = min(max(1, requested), policy.max_output_tokens)

    before = estimate_message_tokens(messages)
    governed_messages = _trim_messages(messages, policy.max_prompt_tokens)
    after = estimate_message_tokens(governed_messages)

    decision = TokenDecision(
        policy=policy.name,
        estimated_prompt_tokens_before=before,
        estimated_prompt_tokens_after=after,
        requested_output_tokens=requested,
        allowed_output_tokens=allowed,
        messages_before=len(messages),
        messages_after=len(governed_messages),
        trimmed=len(governed_messages) < len(messages),
    )
    return governed_messages, decision
