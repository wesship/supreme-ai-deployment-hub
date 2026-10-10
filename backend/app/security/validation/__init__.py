"""
D3VONN SOC Validation Suite

End-to-end validation that exercises the entire security pipeline:
- Event ingestion → correlation → alert generation → incident creation
- Agent task assignment and completion
- Playbook execution
- Risk score recalculation
- MITRE ATT&CK mapping
- Dashboard updates
- Audit log completeness
- Multi-tenant isolation
- Recovery from simulated component failures

Run with: python -m backend.app.security.validation
"""

from .scenarios import SyntheticAttackScenarios
from .runner import ValidationRunner

__all__ = ["SyntheticAttackScenarios", "ValidationRunner"]
