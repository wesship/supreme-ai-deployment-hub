"""
D3VONN Cyber Command Center — AI Agent Workforce

Agent hierarchy:
- SOC Commander (orchestrator)
  ├── Sentinel (log analysis)
  ├── Guardian (identity monitoring)
  ├── Hunter (threat hunting)
  ├── Oracle (threat intelligence)
  ├── Analyst (investigation & reporting)
  ├── Engineer (remediation suggestions)
  └── Compliance (framework mapping)
"""

from backend.app.security.agents.base import BaseSecurityAgent, AgentTask, AgentResult
from backend.app.security.agents.soc_commander import SOCCommander
from backend.app.security.agents.sentinel import SentinelAgent
from backend.app.security.agents.guardian import GuardianAgent
from backend.app.security.agents.hunter import HunterAgent
from backend.app.security.agents.oracle import OracleAgent
from backend.app.security.agents.analyst import AnalystAgent
from backend.app.security.agents.engineer import EngineerAgent
from backend.app.security.agents.compliance_agent import ComplianceAgent

AGENT_REGISTRY: dict[str, type[BaseSecurityAgent]] = {
    "soc_commander": SOCCommander,
    "sentinel": SentinelAgent,
    "guardian": GuardianAgent,
    "hunter": HunterAgent,
    "oracle": OracleAgent,
    "analyst": AnalystAgent,
    "engineer": EngineerAgent,
    "compliance": ComplianceAgent,
}

__all__ = [
    "BaseSecurityAgent",
    "AgentTask",
    "AgentResult",
    "SOCCommander",
    "SentinelAgent",
    "GuardianAgent",
    "HunterAgent",
    "OracleAgent",
    "AnalystAgent",
    "EngineerAgent",
    "ComplianceAgent",
    "AGENT_REGISTRY",
]
