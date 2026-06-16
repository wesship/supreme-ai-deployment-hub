from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any

OUTPUT_CODES = {"TABLE", "JSON", "YAML", "MARKDOWN", "MERMAID", "FLOWCHART", "TECHNICAL", "BEGINNER"}

COMMANDS: dict[str, dict[str, Any]] = {
    "PRIMETIME": {"approval": 0},
    "PROJECT-SCAN": {"approval": 0},
    "PROJECT-STATUS": {"approval": 0},
    "PROJECT-GAP": {"approval": 0},
    "PROJECT-NEXT": {"approval": 0},
    "CRM-AUDIT": {"approval": 0, "aliases": ["CRM-REVIEW", "AUDIT-CRM"]},
    "CRM-PIPELINE": {"approval": 1},
    "TOP25": {"approval": 1},
    "LEAD-GEN": {"approval": 1},
    "COMPLIANCE-CHECK": {"approval": 2, "regulated": True},
    "TCPA-CHECK": {"approval": 3, "regulated": True},
    "DNC-CHECK": {"approval": 3, "regulated": True},
    "PRIVACY-CHECK": {"approval": 2, "regulated": True},
    "HUMAN-APPROVAL": {"approval": 2},
    "ESCALATE-LICENSED": {"approval": 3, "regulated": True},
    "AGENT-DESIGN": {"approval": 1},
    "AGENT-ROUTER": {"approval": 1},
    "N8N-BUILD": {"approval": 1},
    "SMS-SEQUENCE": {"approval": 2},
    "EMAIL-SEQUENCE": {"approval": 2},
    "PRODUCTION-READY": {"approval": 1},
    "TABLE": {"approval": 0, "conflicts": ["JSON", "YAML"]},
    "JSON": {"approval": 0, "conflicts": ["TABLE", "YAML"]},
    "YAML": {"approval": 0, "conflicts": ["TABLE", "JSON"]},
    "TECHNICAL": {"approval": 0, "conflicts": ["BEGINNER"]},
    "BEGINNER": {"approval": 0, "conflicts": ["TECHNICAL"]},
}

MASTER_CODES = {
    "PRIMETIME-360": ["PROJECT-SCAN", "PROJECT-STATUS", "PROJECT-GAP", "COMPLIANCE-CHECK", "PROJECT-NEXT"],
    "CRM-360": ["CRM-AUDIT", "CRM-PIPELINE", "PRODUCTION-READY"],
    "AUTOMATION-360": ["N8N-BUILD", "HUMAN-APPROVAL"],
    "COMPLIANCE-360": ["COMPLIANCE-CHECK", "TCPA-CHECK", "DNC-CHECK", "PRIVACY-CHECK", "ESCALATE-LICENSED"],
    "LEADS-360": ["TOP25", "LEAD-GEN", "CRM-PIPELINE"],
}


def normalize_code(value: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[\s_]+", "-", value.strip().upper()))


def _aliases() -> dict[str, str]:
    result: dict[str, str] = {}
    for code, definition in COMMANDS.items():
        for alias in definition.get("aliases", []):
            result[normalize_code(alias)] = code
    return result


def _expand(code: str, stack: tuple[str, ...] = ()) -> list[str]:
    if code not in MASTER_CODES:
        return [code]
    if code in stack:
        raise ValueError(f"Circular master code: {' -> '.join((*stack, code))}")
    expanded: list[str] = []
    for child in MASTER_CODES[code]:
        expanded.extend(_expand(normalize_code(child), (*stack, code)))
    return expanded


def parse_command(raw: str) -> dict[str, Any]:
    command_part, separator, instruction = raw.partition(":")
    requested = [normalize_code(item) for item in command_part.split("+") if item.strip()]
    aliases = _aliases()
    requested = [aliases.get(code, code) for code in requested]

    expanded: list[str] = []
    for code in requested:
        for child in _expand(code):
            if child not in expanded:
                expanded.append(child)

    unknown = [code for code in expanded if code not in COMMANDS]
    known = [code for code in expanded if code in COMMANDS]
    conflicts: list[dict[str, str]] = []
    seen: set[str] = set()
    for code in known:
        for other in COMMANDS[code].get("conflicts", []):
            if other in known:
                key = "|".join(sorted((code, other)))
                if key not in seen:
                    seen.add(key)
                    conflicts.append({"left": code, "right": other})

    approval = max((int(COMMANDS[code].get("approval", 0)) for code in known), default=0)
    licensed = "ESCALATE-LICENSED" in known or any(
        COMMANDS[code].get("regulated") and int(COMMANDS[code].get("approval", 0)) == 3
        for code in known
    )
    human = licensed or "HUMAN-APPROVAL" in known or approval >= 2
    output = next((code for code in known if code in OUTPUT_CODES), None)

    return {
        "raw": raw,
        "instruction": instruction.strip() if separator else "",
        "requestedCodes": requested,
        "expandedCodes": expanded,
        "unknownCodes": unknown,
        "conflicts": conflicts,
        "approvalLevel": approval,
        "humanApprovalRequired": human,
        "licensedReviewRequired": licensed,
        "outputFormat": output,
        "registryVersion": "1.0.0",
    }
