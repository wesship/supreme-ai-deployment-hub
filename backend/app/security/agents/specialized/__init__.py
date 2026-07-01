"""
Specialized AI Security Operations Agents

Extends the base agent workforce with domain-specific agents:
- Detection Engineer: Creates and tunes detection rules
- Threat Hunter: Proactive threat hunting with hypothesis-driven investigation
- Incident Commander: Manages incident lifecycle and coordination
- Malware Analyst: Analyzes suspicious files and behaviors
- Forensics Analyst: Digital forensics and evidence preservation
- Vulnerability Analyst: Vulnerability assessment and prioritization
- Compliance Officer: Compliance monitoring and audit preparation
- Executive Reporting Agent: Generates executive-level security reports
"""

from .detection_engineer import DetectionEngineerAgent
from .threat_hunter_v2 import ThreatHunterV2Agent
from .incident_commander import IncidentCommanderAgent
from .malware_analyst import MalwareAnalystAgent
from .forensics_analyst import ForensicsAnalystAgent
from .vulnerability_analyst import VulnerabilityAnalystAgent
from .compliance_officer import ComplianceOfficerAgent
from .executive_reporter import ExecutiveReporterAgent

__all__ = [
    "DetectionEngineerAgent",
    "ThreatHunterV2Agent",
    "IncidentCommanderAgent",
    "MalwareAnalystAgent",
    "ForensicsAnalystAgent",
    "VulnerabilityAnalystAgent",
    "ComplianceOfficerAgent",
    "ExecutiveReporterAgent",
]
