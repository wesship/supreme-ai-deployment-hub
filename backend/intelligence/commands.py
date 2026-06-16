from __future__ import annotations

import re
from typing import Any

OUTPUT_CODES = {"TABLE", "JSON", "YAML", "MARKDOWN", "MERMAID", "FLOWCHART", "TECHNICAL", "BEGINNER"}


def _cmd(approval: int, regulated: bool = False, aliases: list[str] | None = None, conflicts: list[str] | None = None) -> dict[str, Any]:
    return {"approval": approval, "regulated": regulated, "aliases": aliases or [], "conflicts": conflicts or []}


COMMANDS: dict[str, dict[str, Any]] = {
    "PRIMETIME": _cmd(0), "PROJECT-SCAN": _cmd(0), "PROJECT-STATUS": _cmd(0),
    "PROJECT-GAP": _cmd(0), "PROJECT-PRIORITY": _cmd(0), "PROJECT-NEXT": _cmd(0),
    "PROJECT-ROADMAP": _cmd(1), "PROJECT-BUILD": _cmd(1),
    "CRM-AUDIT": _cmd(0, aliases=["CRM-REVIEW", "AUDIT-CRM"]), "CRM-PIPELINE": _cmd(1),
    "CRM-TASKS": _cmd(1), "CRM-APPOINTMENTS": _cmd(1), "CRM-REPORTS": _cmd(1),
    "CRM-RBAC": _cmd(2), "RLS-AUDIT": _cmd(2),
    "TOP25": _cmd(1), "LEAD-GEN": _cmd(1), "LEAD-QUALIFY": _cmd(1),
    "LEAD-NURTURE": _cmd(2), "APPOINTMENT-SET": _cmd(2), "FOLLOWUP-PLAN": _cmd(1),
    "REFERRAL-ENGINE": _cmd(1), "CONVERSION-AUDIT": _cmd(0),
    "COMPLIANCE-CHECK": _cmd(2, True), "INSURANCE-COMPLIANCE": _cmd(3, True),
    "TCPA-CHECK": _cmd(3, True), "DNC-CHECK": _cmd(3, True), "PRIVACY-CHECK": _cmd(2, True),
    "NO-MISREP": _cmd(3, True), "DISCLOSURE-CHECK": _cmd(3, True), "RECORDKEEPING": _cmd(2, True),
    "HUMAN-APPROVAL": _cmd(2), "ESCALATE-LICENSED": _cmd(3, True),
    "AGENT-DESIGN": _cmd(1), "AGENT-SOUL": _cmd(1), "AGENT-TOOLS": _cmd(1),
    "AGENT-MEMORY": _cmd(1), "AGENT-WORKFLOW": _cmd(1), "AGENT-GUARDRAILS": _cmd(2),
    "AGENT-TEST": _cmd(1), "AGENT-SCORECARD": _cmd(1), "AGENT-ROUTER": _cmd(1),
    "N8N-BUILD": _cmd(1), "N8N-ERROR": _cmd(1), "N8N-LOGGING": _cmd(1), "N8N-APPROVAL": _cmd(2),
    "SMS-SEQUENCE": _cmd(2), "EMAIL-SEQUENCE": _cmd(2),
    "ARCHITECTURE": _cmd(1), "ENV-CHECK": _cmd(1), "SECURITY-AUDIT": _cmd(2),
    "TEST-BUILD": _cmd(1), "CI-CD": _cmd(1), "DEPLOYMENT": _cmd(2),
    "BACKUP-PLAN": _cmd(1), "PRODUCTION-READY": _cmd(1),
    "KPI-BUILD": _cmd(0), "FUNNEL-METRICS": _cmd(0), "TEAM-PERFORMANCE": _cmd(0),
    "COST-MODEL": _cmd(0), "REVENUE-MODEL": _cmd(0), "BOTTLENECK": _cmd(0), "WEEKLY-REPORT": _cmd(0),
    "TABLE": _cmd(0, conflicts=["JSON", "YAML"]), "JSON": _cmd(0, conflicts=["TABLE", "YAML"]),
    "YAML": _cmd(0, conflicts=["TABLE", "JSON"]), "MARKDOWN": _cmd(0),
    "TECHNICAL": _cmd(0, conflicts=["BEGINNER"]), "BEGINNER": _cmd(0, conflicts=["TECHNICAL"]),
}

MASTER_CODES = {
    "PRIMETIME-360": ["PROJECT-SCAN", "PROJECT-STATUS", "PROJECT-GAP", "PROJECT-PRIORITY", "COMPLIANCE-CHECK", "SECURITY-AUDIT", "PROJECT-NEXT"],
    "CRM-360": ["CRM-AUDIT", "CRM-PIPELINE", "CRM-TASKS", "CRM-APPOINTMENTS", "CRM-REPORTS", "CRM-RBAC", "RLS-AUDIT", "PRODUCTION-READY"],
    "AUTOMATION-360": ["N8N-BUILD", "AGENT-WORKFLOW", "N8N-ERROR", "N8N-LOGGING", "N8N-APPROVAL", "HUMAN-APPROVAL"],
    "COMPLIANCE-360": ["INSURANCE-COMPLIANCE", "TCPA-CHECK", "DNC-CHECK", "PRIVACY-CHECK", "NO-MISREP", "DISCLOSURE-CHECK", "RECORDKEEPING", "ESCALATE-LICENSED"],
    "AGENT-360": ["AGENT-DESIGN", "AGENT-SOUL", "AGENT-TOOLS", "AGENT-MEMORY", "AGENT-WORKFLOW", "AGENT-GUARDRAILS", "AGENT-TEST", "AGENT-SCORECARD"],
    "LEADS-360": ["TOP25", "LEAD-GEN", "LEAD-QUALIFY", "LEAD-NURTURE", "APPOINTMENT-SET", "FOLLOWUP-PLAN", "REFERRAL-ENGINE", "CONVERSION-AUDIT"],
    "DEPLOY-360": ["ARCHITECTURE", "ENV-CHECK", "SECURITY-AUDIT", "TEST-BUILD", "CI-CD", "DEPLOYMENT", "BACKUP-PLAN", "PRODUCTION-READY"],
    "BUSINESS-360": ["KPI-BUILD", "FUNNEL-METRICS", "TEAM-PERFORMANCE", "COST-MODEL", "REVENUE-MODEL", "BOTTLENECK", "WEEKLY-REPORT", "PROJECT-NEXT"],
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
    licensed = "ESCALATE-LICENSED" in known or any(COMMANDS[code].get("regulated") and int(COMMANDS[code].get("approval", 0)) == 3 for code in known)
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
        "registryVersion": "1.1.0",
    }
