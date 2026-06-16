from __future__ import annotations

from typing import Any

WORKFLOW_VERSION = "1.0.0"

AGENTS = [
    {"id": "primetime-supervisor", "categories": ["project", "analysis", "format"]},
    {"id": "crm-architect", "categories": ["crm"]},
    {"id": "policy-reviewer", "categories": ["compliance", "control"]},
    {"id": "automation-engineer", "categories": ["automation"]},
    {"id": "agent-architect", "categories": ["agent"]},
    {"id": "sales-operations", "categories": ["sales", "messaging"]},
    {"id": "security-reviewer", "categories": ["security"]},
    {"id": "software-engineer", "categories": ["development"]},
    {"id": "business-analyst", "categories": ["analytics"]},
]

PREFIXES = {
    "CRM": "crm", "PROJECT": "project", "LEAD": "sales", "TOP25": "sales",
    "COMPLIANCE": "compliance", "TCPA": "compliance", "DNC": "compliance",
    "PRIVACY": "compliance", "AGENT": "agent", "N8N": "automation",
    "SMS": "messaging", "EMAIL": "messaging", "SECURITY": "security",
    "RLS": "security", "ARCHITECTURE": "development", "DEPLOYMENT": "development",
    "PRODUCTION": "development", "KPI": "analytics", "FUNNEL": "analytics",
    "TABLE": "format", "JSON": "format", "YAML": "format", "MARKDOWN": "format",
}


def category_for(code: str) -> str:
    for prefix, category in PREFIXES.items():
        if code.startswith(prefix):
            return category
    return "project"


def route_parsed_command(parsed: dict[str, Any]) -> dict[str, Any]:
    categories = [category_for(code) for code in parsed["expandedCodes"]]
    ranked = []
    for agent in AGENTS:
        score = sum(1 for category in categories if category in agent["categories"])
        if score:
            ranked.append((score, agent))
    ranked.sort(key=lambda item: (-item[0], item[1]["id"]))
    blocked = bool(parsed["unknownCodes"] or parsed["conflicts"])
    status = "blocked" if blocked else "review-required" if parsed["humanApprovalRequired"] else "draft-ready"
    return {
        "primaryAgent": ranked[0][1] if ranked else AGENTS[0],
        "supportingAgents": [agent for _, agent in ranked[1:]],
        "status": status,
    }
