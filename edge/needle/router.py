"""Needle proposes actions; this module never executes device or remote tools."""

from __future__ import annotations

import re
from typing import Any


TOOLS = [
    {"name": name, "description": description, "parameters": {"type": "object", "properties": {}, "required": []}}
    for name, description in (
        ("capture_photo", "Take a photo with the glasses camera"),
        ("start_recording", "Start recording video on the glasses"),
        ("stop_recording", "Stop recording video on the glasses"),
        ("get_battery", "Read the glasses battery level"),
        ("describe_scene", "Ask D3VONN vision to describe the current camera scene"),
        ("read_text", "Ask D3VONN vision to read visible text"),
        ("create_note", "Save a note to D3VONN"),
        ("ask_d3vonn", "Ask D3VONN a question requiring reasoning"),
        ("get_location", "Read the current device location"),
        ("recall_memory", "Recall a memory from D3VONN"),
        ("delete_data", "Delete stored data; requires human approval"),
        ("send_money", "Transfer money; requires human approval"),
    )
]
TOOL_NAMES = {tool["name"] for tool in TOOLS}
LOCAL = {"capture_photo", "start_recording", "stop_recording", "get_battery", "get_location"}
PRIVILEGED = {"delete_data", "send_money"}
REMOTE = TOOL_NAMES - LOCAL - PRIVILEGED


def decide(response: dict[str, Any], *, query: str, threshold: float = 0.85) -> dict[str, Any]:
    """Fail closed on ambiguous, malformed, multi-action, or privileged proposals."""
    if not 0 <= threshold <= 1:
        raise ValueError("threshold must be between 0 and 1")
    if not query or re.search(r"\b(?:do\s+not|don['’]t|never)\b", query, re.IGNORECASE):
        return {"route": "escalate", "reason": "empty_or_negated_request"}
    if not isinstance(response, dict) or response.get("success") is not True or response.get("type") != "call":
        return {"route": "escalate", "reason": "invalid_or_unsupported"}
    calls = response.get("function_calls")
    if not isinstance(calls, list) or len(calls) != 1 or not isinstance(calls[0], dict):
        return {"route": "escalate", "reason": "ambiguous_call"}
    call = calls[0]
    name, arguments = call.get("name"), call.get("arguments")
    if name not in TOOL_NAMES or arguments != {}:
        return {"route": "escalate", "reason": "unknown_tool_or_arguments"}
    if name in PRIVILEGED:
        return {"route": "guardian_review", "reason": "human_approval_required", "call": call}
    validation = response.get("validation")
    if validation is not None and (not isinstance(validation, dict) or validation.get("ungrounded")):
        return {"route": "escalate", "reason": "ungrounded_arguments"}
    confidence = response.get("confidence")
    if isinstance(confidence, bool) or not isinstance(confidence, (int, float)) or not 0 <= confidence <= 1 or confidence < threshold:
        return {"route": "escalate", "reason": "low_or_missing_confidence"}
    return {"route": "local" if name in LOCAL else "d3vonn_gateway", "call": call, "confidence": confidence}


def propose(query: str, *, threshold: float = 0.85) -> dict[str, Any]:
    """Load Needle lazily; return a proposed route without dispatching it."""
    if not query.strip():
        return {"route": "escalate", "reason": "empty_query"}
    import needle  # optional dependency, installed only on the edge device

    agent = needle.Needle(tools=TOOLS)
    return decide(agent.complete(query), query=query, threshold=threshold)
