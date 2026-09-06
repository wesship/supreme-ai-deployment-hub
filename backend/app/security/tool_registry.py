"""D3VONN Cyber Tool Registry.

This registry exposes security capabilities to Hermes as governed metadata only.
It does not execute scanners, exploitation frameworks, credential attacks, or
other security tools. Execution belongs behind separate authorization gates.
"""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class RiskTier(str, Enum):
    green = "green"
    yellow = "yellow"
    red = "red"


class ToolStatus(str, Enum):
    approved = "approved"
    sandbox_only = "sandbox_only"
    restricted = "restricted"
    deprecated = "deprecated"


class ActivityClass(str, Enum):
    passive = "passive"
    active = "active"
    restricted = "restricted"


class CapabilityPolicy(BaseModel):
    capability: str
    activity_class: ActivityClass = ActivityClass.passive
    requires_asset_authorization: bool = False
    requires_human_approval: bool = False
    production_allowed: bool = True


class AgentAccess(BaseModel):
    security_agent: bool = True
    hermes: bool = True
    general_agents: bool = False


class LoggingPolicy(BaseModel):
    security_events: bool = True
    agent_actions: bool = True


class CyberTool(BaseModel):
    tool_id: str
    name: str
    category: str
    description: str
    execution_mode: Literal["api", "local", "library", "platform", "reference"]
    risk_tier: RiskTier
    status: ToolStatus
    capabilities: list[CapabilityPolicy]
    agent_access: AgentAccess = Field(default_factory=AgentAccess)
    logging: LoggingPolicy = Field(default_factory=LoggingPolicy)
    source_url: str
    source_origin: str = "d3vonn_baseline"
    startme_membership: Literal["verified", "unverified", "not_applicable"] = "unverified"


class PolicyDecision(BaseModel):
    tool_id: str
    capability: str
    decision: Literal["allow", "deny", "approval_required"]
    reason: str
    activity_class: ActivityClass
    production_execution: bool = False
    requires_asset_authorization: bool = False
    requires_human_approval: bool = False


def _cap(
    capability: str,
    activity: ActivityClass = ActivityClass.passive,
    *,
    asset: bool = False,
    approval: bool = False,
    production: bool = True,
) -> CapabilityPolicy:
    return CapabilityPolicy(
        capability=capability,
        activity_class=activity,
        requires_asset_authorization=asset,
        requires_human_approval=approval,
        production_allowed=production,
    )


TOOLS: tuple[CyberTool, ...] = (
    CyberTool(
        tool_id="wazuh",
        name="Wazuh",
        category="siem_xdr",
        description="Open-source SIEM/XDR telemetry, detection, and endpoint security platform.",
        execution_mode="platform",
        risk_tier=RiskTier.green,
        status=ToolStatus.approved,
        capabilities=[
            _cap("log_analysis"),
            _cap("threat_detection"),
            _cap("file_integrity_monitoring"),
        ],
        source_url="https://wazuh.com/",
    ),
    CyberTool(
        tool_id="stixview",
        name="STIXview",
        category="threat_intelligence",
        description="STIX 2 visualization for threat-intelligence relationships.",
        execution_mode="reference",
        risk_tier=RiskTier.green,
        status=ToolStatus.approved,
        capabilities=[_cap("stix_visualization"), _cap("relationship_analysis")],
        source_url="https://github.com/traut/stixview",
    ),
    CyberTool(
        tool_id="sigma",
        name="Sigma",
        category="detection_engineering",
        description="Portable detection-rule format for SIEM and detection-as-code workflows.",
        execution_mode="library",
        risk_tier=RiskTier.green,
        status=ToolStatus.approved,
        capabilities=[_cap("detection_rule_authoring"), _cap("detection_rule_translation")],
        source_url="https://github.com/SigmaHQ/sigma",
    ),
    CyberTool(
        tool_id="yara",
        name="YARA",
        category="detection_engineering",
        description="Pattern-matching engine commonly used for malware and file classification.",
        execution_mode="local",
        risk_tier=RiskTier.green,
        status=ToolStatus.approved,
        capabilities=[_cap("file_pattern_matching"), _cap("malware_classification")],
        source_url="https://github.com/VirusTotal/yara",
    ),
    CyberTool(
        tool_id="suricata",
        name="Suricata",
        category="network_detection",
        description="Network IDS/IPS and network security monitoring engine.",
        execution_mode="local",
        risk_tier=RiskTier.green,
        status=ToolStatus.approved,
        capabilities=[
            _cap("network_detection"),
            _cap("packet_analysis"),
        ],
        source_url="https://suricata.io/",
    ),
    CyberTool(
        tool_id="virustotal",
        name="VirusTotal",
        category="threat_intelligence",
        description="Passive hash, URL, domain, and IP reputation/enrichment service.",
        execution_mode="api",
        risk_tier=RiskTier.green,
        status=ToolStatus.approved,
        capabilities=[
            _cap("hash_enrichment"),
            _cap("url_enrichment"),
            _cap("domain_enrichment"),
            _cap("ip_enrichment"),
        ],
        source_url="https://www.virustotal.com/",
    ),
    CyberTool(
        tool_id="shodan",
        name="Shodan",
        category="attack_surface",
        description="Internet-exposure intelligence and service discovery from an external index.",
        execution_mode="api",
        risk_tier=RiskTier.yellow,
        status=ToolStatus.approved,
        capabilities=[
            _cap("ip_enrichment"),
            _cap("indexed_service_discovery"),
        ],
        source_url="https://www.shodan.io/",
    ),
    CyberTool(
        tool_id="censys",
        name="Censys",
        category="attack_surface",
        description="Internet asset, certificate, host, and service intelligence from a search index.",
        execution_mode="api",
        risk_tier=RiskTier.yellow,
        status=ToolStatus.approved,
        capabilities=[
            _cap("certificate_intelligence"),
            _cap("host_enrichment"),
            _cap("indexed_service_discovery"),
        ],
        source_url="https://search.censys.io/",
    ),
    CyberTool(
        tool_id="haveibeenpwned",
        name="Have I Been Pwned",
        category="exposure_intelligence",
        description="Breach exposure lookup for approved identity-security workflows.",
        execution_mode="api",
        risk_tier=RiskTier.yellow,
        status=ToolStatus.approved,
        capabilities=[_cap("breach_exposure_lookup", asset=True)],
        source_url="https://haveibeenpwned.com/",
    ),
    CyberTool(
        tool_id="codeql",
        name="CodeQL",
        category="application_security",
        description="Static analysis and semantic code-query engine.",
        execution_mode="platform",
        risk_tier=RiskTier.green,
        status=ToolStatus.approved,
        capabilities=[_cap("sast"), _cap("code_security_query")],
        source_url="https://github.com/github/codeql",
        startme_membership="not_applicable",
    ),
    CyberTool(
        tool_id="gitleaks",
        name="Gitleaks",
        category="application_security",
        description="Secrets detection for source repositories and CI pipelines.",
        execution_mode="local",
        risk_tier=RiskTier.green,
        status=ToolStatus.approved,
        capabilities=[_cap("secrets_detection")],
        source_url="https://github.com/gitleaks/gitleaks",
        startme_membership="not_applicable",
    ),
    CyberTool(
        tool_id="trivy",
        name="Trivy",
        category="application_security",
        description="Dependency, container, filesystem, and IaC vulnerability scanning.",
        execution_mode="local",
        risk_tier=RiskTier.green,
        status=ToolStatus.approved,
        capabilities=[_cap("sca"), _cap("container_scan"), _cap("iac_scan")],
        source_url="https://github.com/aquasecurity/trivy",
        startme_membership="not_applicable",
    ),
    CyberTool(
        tool_id="nmap",
        name="Nmap",
        category="attack_surface",
        description="Network discovery and service enumeration. Active use requires explicit asset authorization.",
        execution_mode="local",
        risk_tier=RiskTier.yellow,
        status=ToolStatus.restricted,
        capabilities=[
            _cap(
                "active_service_discovery",
                ActivityClass.active,
                asset=True,
                approval=True,
                production=True,
            )
        ],
        source_url="https://nmap.org/",
    ),
    CyberTool(
        tool_id="owasp_zap",
        name="OWASP ZAP",
        category="application_security",
        description="Dynamic application security testing. Active tests require explicit authorization.",
        execution_mode="local",
        risk_tier=RiskTier.yellow,
        status=ToolStatus.restricted,
        capabilities=[
            _cap("dast", ActivityClass.active, asset=True, approval=True, production=True),
            _cap("api_security_test", ActivityClass.active, asset=True, approval=True, production=True),
        ],
        source_url="https://www.zaproxy.org/",
    ),
    CyberTool(
        tool_id="metasploit",
        name="Metasploit Framework",
        category="security_validation",
        description="Dual-use exploitation framework kept outside autonomous production workflows.",
        execution_mode="local",
        risk_tier=RiskTier.red,
        status=ToolStatus.sandbox_only,
        capabilities=[
            _cap(
                "exploit_validation",
                ActivityClass.restricted,
                asset=True,
                approval=True,
                production=False,
            )
        ],
        agent_access=AgentAccess(security_agent=False, hermes=False, general_agents=False),
        source_url="https://github.com/rapid7/metasploit-framework",
    ),
)


_TOOL_INDEX = {tool.tool_id: tool for tool in TOOLS}


def list_tools(
    *,
    category: str | None = None,
    risk_tier: RiskTier | None = None,
    status: ToolStatus | None = None,
) -> list[CyberTool]:
    tools = list(TOOLS)
    if category:
        tools = [tool for tool in tools if tool.category == category]
    if risk_tier:
        tools = [tool for tool in tools if tool.risk_tier == risk_tier]
    if status:
        tools = [tool for tool in tools if tool.status == status]
    return tools


def get_tool(tool_id: str) -> CyberTool | None:
    return _TOOL_INDEX.get(tool_id.strip().lower())


def evaluate_policy(
    *,
    tool_id: str,
    capability: str,
    environment: str = "production",
    asset_authorized: bool = False,
    human_approved: bool = False,
    actor: Literal["security_agent", "hermes", "general_agent", "human"] = "hermes",
) -> PolicyDecision:
    tool = get_tool(tool_id)
    if tool is None:
        return PolicyDecision(
            tool_id=tool_id,
            capability=capability,
            decision="deny",
            reason="tool_not_registered",
            activity_class=ActivityClass.restricted,
        )

    cap = next((item for item in tool.capabilities if item.capability == capability), None)
    if cap is None:
        return PolicyDecision(
            tool_id=tool.tool_id,
            capability=capability,
            decision="deny",
            reason="capability_not_registered",
            activity_class=ActivityClass.restricted,
        )

    if tool.status == ToolStatus.deprecated:
        return PolicyDecision(
            tool_id=tool.tool_id,
            capability=capability,
            decision="deny",
            reason="tool_deprecated",
            activity_class=cap.activity_class,
        )

    if actor != "human":
        allowed = {
            "security_agent": tool.agent_access.security_agent,
            "hermes": tool.agent_access.hermes,
            "general_agent": tool.agent_access.general_agents,
        }[actor]
        if not allowed:
            return PolicyDecision(
                tool_id=tool.tool_id,
                capability=capability,
                decision="deny",
                reason="agent_not_authorized",
                activity_class=cap.activity_class,
                requires_asset_authorization=cap.requires_asset_authorization,
                requires_human_approval=cap.requires_human_approval,
            )

    env = environment.strip().lower()
    if cap.activity_class == ActivityClass.restricted:
        if env not in {"sandbox", "lab", "test"}:
            return PolicyDecision(
                tool_id=tool.tool_id,
                capability=capability,
                decision="deny",
                reason="restricted_capability_sandbox_only",
                activity_class=cap.activity_class,
                requires_asset_authorization=True,
                requires_human_approval=True,
            )
        if not asset_authorized or not human_approved:
            return PolicyDecision(
                tool_id=tool.tool_id,
                capability=capability,
                decision="approval_required",
                reason="restricted_capability_requires_asset_authorization_and_human_approval",
                activity_class=cap.activity_class,
                requires_asset_authorization=True,
                requires_human_approval=True,
            )
        return PolicyDecision(
            tool_id=tool.tool_id,
            capability=capability,
            decision="allow",
            reason="authorized_sandbox_validation",
            activity_class=cap.activity_class,
            requires_asset_authorization=True,
            requires_human_approval=True,
            production_execution=False,
        )

    if env == "production" and not cap.production_allowed:
        return PolicyDecision(
            tool_id=tool.tool_id,
            capability=capability,
            decision="deny",
            reason="capability_not_allowed_in_production",
            activity_class=cap.activity_class,
        )

    missing_asset_auth = cap.requires_asset_authorization and not asset_authorized
    missing_approval = cap.requires_human_approval and not human_approved
    if missing_asset_auth or missing_approval:
        return PolicyDecision(
            tool_id=tool.tool_id,
            capability=capability,
            decision="approval_required",
            reason="asset_authorization_or_human_approval_required",
            activity_class=cap.activity_class,
            requires_asset_authorization=cap.requires_asset_authorization,
            requires_human_approval=cap.requires_human_approval,
        )

    return PolicyDecision(
        tool_id=tool.tool_id,
        capability=capability,
        decision="allow",
        reason="registry_policy_satisfied",
        activity_class=cap.activity_class,
        requires_asset_authorization=cap.requires_asset_authorization,
        requires_human_approval=cap.requires_human_approval,
        production_execution=cap.activity_class == ActivityClass.active and env == "production",
    )


def graph_projection() -> dict[str, list[dict]]:
    """Project registry metadata into Security Knowledge Graph-shaped nodes/edges.

    This is read-only and does not write to Supabase. A later persistence gate can
    consume the projection through the existing SecurityKnowledgeGraph service.
    """
    nodes: list[dict] = []
    edges: list[dict] = []
    seen_capabilities: set[str] = set()

    for tool in TOOLS:
        nodes.append(
            {
                "node_type": "security_tool",
                "node_id": tool.tool_id,
                "label": tool.name,
                "properties": {
                    "category": tool.category,
                    "risk_tier": tool.risk_tier.value,
                    "status": tool.status.value,
                    "execution_mode": tool.execution_mode,
                    "agent_access": tool.agent_access.model_dump(),
                    "source_url": tool.source_url,
                    "source_origin": tool.source_origin,
                    "startme_membership": tool.startme_membership,
                },
            }
        )
        for capability in tool.capabilities:
            cap_id = capability.capability
            if cap_id not in seen_capabilities:
                seen_capabilities.add(cap_id)
                nodes.append(
                    {
                        "node_type": "security_capability",
                        "node_id": cap_id,
                        "label": cap_id.replace("_", " ").title(),
                        "properties": {},
                    }
                )
            edges.append(
                {
                    "source": {"node_type": "security_tool", "node_id": tool.tool_id},
                    "target": {"node_type": "security_capability", "node_id": cap_id},
                    "relationship": "provides_capability",
                    "properties": capability.model_dump(mode="json"),
                }
            )

    return {"nodes": nodes, "edges": edges}


def stix_projection() -> list[dict]:
    """Return STIX-compatible custom objects without claiming native STIX tool types."""
    objects: list[dict] = []
    for tool in TOOLS:
        objects.append(
            {
                "type": "x-d3vonn-security-tool",
                "spec_version": "2.1",
                "id": f"x-d3vonn-security-tool--{tool.tool_id}",
                "name": tool.name,
                "category": tool.category,
                "risk_tier": tool.risk_tier.value,
                "status": tool.status.value,
                "capabilities": [cap.model_dump(mode="json") for cap in tool.capabilities],
                "source_url": tool.source_url,
            }
        )
    return objects
