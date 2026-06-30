"""
backend/app/security/agents/soc_commander.py — Hermes SOC Commander

The orchestrator agent that coordinates the entire security workforce.
Responsibilities:
- Receive alerts and determine which agents to dispatch
- Prioritize and queue tasks for specialized agents
- Manage escalations and cross-agent correlation
- Generate executive-level status reports
"""

from __future__ import annotations

from typing import Any

from backend.app.security.agents.base import BaseSecurityAgent, AgentTask, AgentResult


class SOCCommander(BaseSecurityAgent):
    agent_id = "soc_commander"
    name = "Hermes SOC Commander"
    description = "Coordinates all security agents, prioritizes tasks, and manages escalations."
    capabilities = ["orchestration", "prioritization", "escalation", "reporting"]

    # Agent dispatch mapping: alert rule → agents to activate
    DISPATCH_MAP: dict[str, list[str]] = {
        "brute_force_login": ["sentinel", "guardian"],
        "api_abuse": ["sentinel", "engineer"],
        "admin_privilege_escalation": ["guardian", "compliance"],
        "token_reuse": ["guardian", "hunter"],
        "secret_leak": ["hunter", "engineer"],
        "anomaly_detected": ["hunter", "oracle"],
        "compliance_violation": ["compliance", "analyst"],
    }

    # Severity → priority mapping
    SEVERITY_PRIORITY: dict[str, int] = {
        "critical": 10,
        "high": 8,
        "medium": 5,
        "low": 3,
        "info": 1,
    }

    async def analyze(self, task: AgentTask) -> list[dict[str, Any]]:
        """
        Analyze incoming alert/event and determine dispatch strategy.
        """
        alert = task.input_data.get("alert", {})
        rule_id = alert.get("rule_id", "")
        severity = alert.get("severity", "medium")

        # Determine which agents to dispatch
        agents_to_dispatch = self.DISPATCH_MAP.get(rule_id, ["sentinel"])

        # Always include analyst for high/critical
        if severity in ("high", "critical") and "analyst" not in agents_to_dispatch:
            agents_to_dispatch.append("analyst")

        findings = [{
            "type": "dispatch_plan",
            "rule_id": rule_id,
            "severity": severity,
            "agents": agents_to_dispatch,
            "priority": self.SEVERITY_PRIORITY.get(severity, 5),
            "escalation_required": severity == "critical",
        }]

        return findings

    async def act(self, task: AgentTask, findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Queue tasks for the determined agents.
        """
        actions: list[dict[str, Any]] = []

        for finding in findings:
            if finding.get("type") != "dispatch_plan":
                continue

            agents = finding.get("agents", [])
            priority = finding.get("priority", 5)

            for agent_id in agents:
                # Queue task for each agent
                try:
                    self.db.table("security_agent_tasks").insert({
                        "agent_id": agent_id,
                        "task_type": f"investigate_{finding.get('rule_id', 'unknown')}",
                        "priority": priority,
                        "status": "queued",
                        "input_data": task.input_data,
                        "parent_task_id": task.task_id,
                    }).execute()

                    actions.append({
                        "action": "dispatch",
                        "target_agent": agent_id,
                        "priority": priority,
                        "status": "queued",
                    })
                except Exception as exc:
                    self.logger.error("Failed to dispatch to %s: %s", agent_id, exc)
                    actions.append({
                        "action": "dispatch",
                        "target_agent": agent_id,
                        "status": "failed",
                        "error": str(exc),
                    })

        return actions

    async def report(
        self, task: AgentTask, findings: list[dict[str, Any]], actions: list[dict[str, Any]]
    ) -> AgentResult:
        """Generate orchestration result."""
        successful_dispatches = [a for a in actions if a.get("status") == "queued"]

        return AgentResult(
            agent_id=self.agent_id,
            task_id=task.task_id,
            status="completed",
            findings=findings,
            actions_taken=actions,
            recommendations=[
                f"Dispatched {len(successful_dispatches)} agents for investigation.",
            ],
            confidence=80,
            metadata={
                "dispatched_agents": [a["target_agent"] for a in successful_dispatches],
                "total_dispatches": len(actions),
            },
        )
