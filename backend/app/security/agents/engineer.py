"""
backend/app/security/agents/engineer.py — Engineer Agent

Remediation agent responsible for:
- Suggesting firewall rules
- Recommending IAM policy changes
- Proposing Kubernetes security fixes
- Docker hardening recommendations
"""

from __future__ import annotations

from typing import Any

from backend.app.security.agents.base import BaseSecurityAgent, AgentTask, AgentResult


class EngineerAgent(BaseSecurityAgent):
    agent_id = "engineer"
    name = "Engineer"
    description = "Remediation — suggests firewall rules, IAM changes, Kubernetes fixes, Docker hardening."
    capabilities = ["firewall_rules", "iam_recommendations", "kubernetes_fixes", "docker_hardening"]

    # Remediation templates by rule type
    REMEDIATION_TEMPLATES: dict[str, dict[str, Any]] = {
        "brute_force_login": {
            "firewall": {
                "action": "block",
                "rule_type": "rate_limit",
                "description": "Rate limit login attempts to 5 per minute per IP",
                "config": {
                    "path": "/api/auth/login",
                    "rate": "5r/m",
                    "action": "block",
                    "duration": "1h",
                },
            },
            "iam": {
                "action": "enforce_mfa",
                "description": "Enforce MFA for all accounts with failed login attempts",
            },
            "application": {
                "action": "implement_lockout",
                "description": "Lock account after 5 failed attempts for 30 minutes",
                "config": {"max_attempts": 5, "lockout_duration": "30m"},
            },
        },
        "api_abuse": {
            "firewall": {
                "action": "rate_limit",
                "rule_type": "waf_rule",
                "description": "Add WAF rule to throttle excessive API requests",
                "config": {
                    "rate": "100r/m",
                    "action": "challenge",
                    "escalation": "block_after_3_challenges",
                },
            },
            "kubernetes": {
                "action": "network_policy",
                "description": "Apply NetworkPolicy to restrict API pod ingress",
                "manifest": {
                    "apiVersion": "networking.k8s.io/v1",
                    "kind": "NetworkPolicy",
                    "metadata": {"name": "api-rate-limit"},
                    "spec": {
                        "podSelector": {"matchLabels": {"app": "api"}},
                        "policyTypes": ["Ingress"],
                    },
                },
            },
        },
        "admin_privilege_escalation": {
            "iam": {
                "action": "review_permissions",
                "description": "Audit all admin role assignments in the last 24h",
                "steps": [
                    "List all users with admin role",
                    "Verify each assignment was authorized",
                    "Revoke unauthorized escalations",
                    "Enable approval workflow for future admin grants",
                ],
            },
            "application": {
                "action": "enable_approval_workflow",
                "description": "Require manager approval for privilege escalation",
            },
        },
        "token_reuse": {
            "application": {
                "action": "rotate_tokens",
                "description": "Force token rotation for affected sessions",
                "config": {
                    "revoke_all_sessions": True,
                    "force_reauth": True,
                    "reduce_token_ttl": "15m",
                },
            },
            "docker": {
                "action": "secret_rotation",
                "description": "Rotate JWT signing keys in container secrets",
                "steps": [
                    "Generate new JWT signing key",
                    "Update Kubernetes secret",
                    "Rolling restart API pods",
                    "Invalidate all existing tokens",
                ],
            },
        },
    }

    async def analyze(self, task: AgentTask) -> list[dict[str, Any]]:
        """
        Analyze the alert and determine appropriate remediation strategies.
        """
        findings: list[dict[str, Any]] = []
        alert = task.input_data.get("alert", {})
        rule_id = alert.get("rule_id", "")
        severity = alert.get("severity", "medium")

        # Get remediation template
        template = self.REMEDIATION_TEMPLATES.get(rule_id, {})

        if template:
            findings.append({
                "type": "remediation_plan",
                "rule_id": rule_id,
                "severity": severity,
                "remediations": template,
                "priority": "immediate" if severity in ("high", "critical") else "scheduled",
            })

        # Check for infrastructure-specific recommendations
        infra_recs = await self._check_infrastructure_context(alert)
        if infra_recs:
            findings.append(infra_recs)

        return findings

    async def _check_infrastructure_context(self, alert: dict[str, Any]) -> dict[str, Any] | None:
        """Check infrastructure context for additional recommendations."""
        ip = alert.get("ip")
        if not ip:
            return None

        try:
            # Check if IP has been seen before
            ip_resp = (
                self.db.table("security_ip_history")
                .select("event_count, abuse_score, is_vpn, is_tor")
                .eq("ip", ip)
                .limit(1)
                .execute()
            )
            ip_data = ip_resp.data[0] if ip_resp.data else None

            if ip_data and (ip_data.get("abuse_score", 0) > 70 or ip_data.get("is_tor")):
                return {
                    "type": "infrastructure_recommendation",
                    "ip": ip,
                    "recommendation": "permanent_block",
                    "reason": "High abuse score or Tor exit node",
                    "cloudflare_rule": {
                        "expression": f'ip.src eq {ip}',
                        "action": "block",
                        "description": f"Auto-block: abuse_score={ip_data.get('abuse_score')}, tor={ip_data.get('is_tor')}",
                    },
                }
        except Exception:
            pass

        return None

    async def act(self, task: AgentTask, findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Record remediation recommendations (auto-apply in future with approval workflow).
        """
        actions: list[dict[str, Any]] = []

        for finding in findings:
            if finding.get("type") == "remediation_plan":
                # Store as agent action for review
                try:
                    self.db.table("hermes_security_actions").insert({
                        "agent_name": "engineer",
                        "action_type": "remediation_recommendation",
                        "target": finding.get("rule_id"),
                        "details": finding.get("remediations"),
                        "status": "recommended",
                    }).execute()
                    actions.append({"action": "store_remediation", "status": "success"})
                except Exception as exc:
                    actions.append({"action": "store_remediation", "status": "failed", "error": str(exc)})

        return actions

    async def report(
        self, task: AgentTask, findings: list[dict[str, Any]], actions: list[dict[str, Any]]
    ) -> AgentResult:
        """Generate Engineer remediation report."""
        recommendations = []
        for finding in findings:
            if finding.get("type") == "remediation_plan":
                for category, details in finding.get("remediations", {}).items():
                    desc = details.get("description", "") if isinstance(details, dict) else str(details)
                    recommendations.append(f"[{category.upper()}] {desc}")

            if finding.get("type") == "infrastructure_recommendation":
                recommendations.append(
                    f"[FIREWALL] Block IP {finding.get('ip')} — {finding.get('reason')}"
                )

        return AgentResult(
            agent_id=self.agent_id,
            task_id=task.task_id,
            status="completed",
            findings=findings,
            actions_taken=actions,
            recommendations=recommendations or ["No specific remediation required at this time."],
            confidence=85,
            metadata={
                "remediation_categories": list(set(
                    cat for f in findings
                    if f.get("type") == "remediation_plan"
                    for cat in f.get("remediations", {}).keys()
                )),
            },
        )
