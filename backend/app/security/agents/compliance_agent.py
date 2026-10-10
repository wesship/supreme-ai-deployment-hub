"""
backend/app/security/agents/compliance_agent.py — Compliance Agent

Compliance mapping agent responsible for:
- Mapping security findings to SOC 2, ISO 27001, CIS Controls, NIST CSF, PCI DSS, HIPAA
- Tracking compliance posture
- Generating compliance reports
- Identifying control gaps
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from backend.app.security.agents.base import BaseSecurityAgent, AgentTask, AgentResult


class ComplianceAgent(BaseSecurityAgent):
    agent_id = "compliance"
    name = "Compliance"
    description = "Compliance mapping — maps findings to SOC 2, ISO 27001, CIS, NIST CSF, PCI DSS, HIPAA."
    capabilities = ["soc2", "iso27001", "cis", "nist_csf", "pci_dss", "hipaa"]

    # Mapping of security rule types to compliance framework controls
    COMPLIANCE_MAPPING: dict[str, dict[str, list[dict[str, str]]]] = {
        "brute_force_login": {
            "soc2": [
                {"control_id": "CC6.1", "control_name": "Logical and Physical Access Controls"},
                {"control_id": "CC6.2", "control_name": "User Authentication"},
            ],
            "iso27001": [
                {"control_id": "A.9.4.2", "control_name": "Secure log-on procedures"},
                {"control_id": "A.9.4.3", "control_name": "Password management system"},
            ],
            "nist_csf": [
                {"control_id": "PR.AC-1", "control_name": "Identities and credentials are issued"},
                {"control_id": "DE.CM-1", "control_name": "Network monitoring"},
            ],
            "pci_dss": [
                {"control_id": "8.1.6", "control_name": "Limit repeated access attempts"},
                {"control_id": "8.1.7", "control_name": "Account lockout duration"},
            ],
            "cis": [
                {"control_id": "CIS.5.2", "control_name": "Use Unique Passwords"},
                {"control_id": "CIS.16.9", "control_name": "Disable Dormant Accounts"},
            ],
        },
        "admin_privilege_escalation": {
            "soc2": [
                {"control_id": "CC6.3", "control_name": "Role-Based Access Control"},
                {"control_id": "CC6.7", "control_name": "Restriction of Privileged Access"},
            ],
            "iso27001": [
                {"control_id": "A.9.2.3", "control_name": "Management of privileged access rights"},
                {"control_id": "A.9.2.5", "control_name": "Review of user access rights"},
            ],
            "nist_csf": [
                {"control_id": "PR.AC-4", "control_name": "Access permissions managed"},
                {"control_id": "PR.AC-6", "control_name": "Identities are proofed"},
            ],
            "pci_dss": [
                {"control_id": "7.1", "control_name": "Limit access to system components"},
                {"control_id": "7.2", "control_name": "Access control systems"},
            ],
            "hipaa": [
                {"control_id": "164.312(a)(1)", "control_name": "Access Control"},
                {"control_id": "164.312(d)", "control_name": "Person or Entity Authentication"},
            ],
        },
        "api_abuse": {
            "soc2": [
                {"control_id": "CC7.2", "control_name": "Monitoring of System Components"},
            ],
            "iso27001": [
                {"control_id": "A.12.4.1", "control_name": "Event logging"},
                {"control_id": "A.14.1.2", "control_name": "Securing application services"},
            ],
            "nist_csf": [
                {"control_id": "DE.AE-1", "control_name": "Baseline of operations established"},
                {"control_id": "DE.CM-7", "control_name": "Monitoring for unauthorized activity"},
            ],
            "pci_dss": [
                {"control_id": "6.5.10", "control_name": "Broken authentication"},
                {"control_id": "10.6", "control_name": "Review logs and security events"},
            ],
        },
        "token_reuse": {
            "soc2": [
                {"control_id": "CC6.1", "control_name": "Logical and Physical Access Controls"},
            ],
            "iso27001": [
                {"control_id": "A.9.4.2", "control_name": "Secure log-on procedures"},
                {"control_id": "A.10.1.1", "control_name": "Policy on use of cryptographic controls"},
            ],
            "nist_csf": [
                {"control_id": "PR.AC-7", "control_name": "Users authenticated"},
                {"control_id": "PR.DS-2", "control_name": "Data-in-transit is protected"},
            ],
            "pci_dss": [
                {"control_id": "8.2.1", "control_name": "Strong cryptography for authentication"},
            ],
            "hipaa": [
                {"control_id": "164.312(a)(2)(iv)", "control_name": "Encryption and Decryption"},
                {"control_id": "164.312(e)(1)", "control_name": "Transmission Security"},
            ],
        },
    }

    async def analyze(self, task: AgentTask) -> list[dict[str, Any]]:
        """
        Map the security finding to relevant compliance frameworks.
        """
        findings: list[dict[str, Any]] = []
        alert = task.input_data.get("alert", {})
        rule_id = alert.get("rule_id", "")

        # Get compliance mapping for this rule
        mapping = self.COMPLIANCE_MAPPING.get(rule_id, {})

        if mapping:
            for framework, controls in mapping.items():
                findings.append({
                    "type": "compliance_mapping",
                    "framework": framework,
                    "rule_id": rule_id,
                    "controls": controls,
                    "status": "potential_violation",
                    "description": f"Alert '{rule_id}' maps to {len(controls)} control(s) in {framework.upper()}",
                })

        # Check current compliance posture
        posture = await self._check_compliance_posture()
        if posture:
            findings.append(posture)

        return findings

    async def _check_compliance_posture(self) -> dict[str, Any] | None:
        """Check overall compliance posture from the compliance table."""
        try:
            resp = (
                self.db.table("security_compliance")
                .select("framework, status", count="exact")
                .execute()
            )
            records = resp.data or []

            if not records:
                return None

            # Aggregate by framework
            posture: dict[str, dict[str, int]] = {}
            for r in records:
                fw = r.get("framework", "unknown")
                status = r.get("status", "not_assessed")
                if fw not in posture:
                    posture[fw] = {}
                posture[fw][status] = posture[fw].get(status, 0) + 1

            return {
                "type": "compliance_posture",
                "frameworks": posture,
                "total_controls": len(records),
            }
        except Exception:
            pass

        return None

    async def act(self, task: AgentTask, findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Record compliance findings and update control statuses."""
        actions: list[dict[str, Any]] = []

        for finding in findings:
            if finding.get("type") != "compliance_mapping":
                continue

            framework = finding.get("framework", "")
            controls = finding.get("controls", [])

            for control in controls:
                try:
                    # Upsert compliance record
                    self.db.table("security_compliance").upsert({
                        "framework": framework,
                        "control_id": control["control_id"],
                        "control_name": control["control_name"],
                        "status": "non_compliant",
                        "last_assessed": datetime.now(timezone.utc).isoformat(),
                        "assessor": "compliance_agent",
                        "notes": f"Flagged by alert: {finding.get('rule_id')}",
                    }, on_conflict="framework,control_id").execute()

                    actions.append({
                        "action": "update_compliance",
                        "framework": framework,
                        "control_id": control["control_id"],
                        "status": "success",
                    })
                except Exception as exc:
                    actions.append({
                        "action": "update_compliance",
                        "framework": framework,
                        "control_id": control["control_id"],
                        "status": "failed",
                        "error": str(exc),
                    })

        return actions

    async def report(
        self, task: AgentTask, findings: list[dict[str, Any]], actions: list[dict[str, Any]]
    ) -> AgentResult:
        """Generate Compliance agent report."""
        frameworks_affected = list(set(
            f.get("framework", "") for f in findings if f.get("type") == "compliance_mapping"
        ))
        total_controls = sum(
            len(f.get("controls", [])) for f in findings if f.get("type") == "compliance_mapping"
        )

        recommendations = []
        if frameworks_affected:
            recommendations.append(
                f"Review compliance posture for: {', '.join(fw.upper() for fw in frameworks_affected)}"
            )
            recommendations.append(
                f"{total_controls} control(s) potentially affected — schedule compliance review."
            )
        else:
            recommendations.append("No compliance framework violations detected.")

        return AgentResult(
            agent_id=self.agent_id,
            task_id=task.task_id,
            status="completed",
            findings=findings,
            actions_taken=actions,
            recommendations=recommendations,
            confidence=80,
            metadata={
                "frameworks_affected": frameworks_affected,
                "controls_flagged": total_controls,
            },
        )
