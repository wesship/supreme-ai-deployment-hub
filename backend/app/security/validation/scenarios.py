"""
backend/app/security/validation/scenarios.py — Synthetic Attack Scenarios

Provides pre-built attack scenarios that exercise every component of the SOC pipeline.
Each scenario generates a sequence of events that should trigger specific detections,
correlations, alerts, and SOAR responses.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class AttackEvent:
    """A single event in an attack scenario."""
    source: str
    event_type: str
    severity: str
    actor_id: str
    actor_email: str
    ip_address: str
    metadata: dict[str, Any] = field(default_factory=dict)
    delay_seconds: float = 0.0


@dataclass
class ExpectedOutcome:
    """What should happen after the scenario completes."""
    alerts_min: int = 0
    alerts_max: int = 100
    incidents_min: int = 0
    correlations_min: int = 0
    risk_score_min: int = 0
    playbook_triggered: bool = False
    mitre_tactics: list[str] = field(default_factory=list)
    mitre_techniques: list[str] = field(default_factory=list)


@dataclass
class AttackScenario:
    """A complete attack scenario with events and expected outcomes."""
    id: str
    name: str
    description: str
    category: str
    events: list[AttackEvent]
    expected: ExpectedOutcome
    mitre_tactics: list[str] = field(default_factory=list)
    mitre_techniques: list[str] = field(default_factory=list)


class SyntheticAttackScenarios:
    """Factory for synthetic attack scenarios."""

    @classmethod
    def all_scenarios(cls) -> list[AttackScenario]:
        """Return all available attack scenarios."""
        return [
            cls.credential_stuffing(),
            cls.account_takeover(),
            cls.api_abuse(),
            cls.privilege_escalation(),
            cls.lateral_movement(),
            cls.data_exfiltration(),
            cls.token_theft(),
            cls.insider_threat(),
            cls.supply_chain_attack(),
            cls.ransomware_precursor(),
        ]

    @classmethod
    def credential_stuffing(cls) -> AttackScenario:
        """Simulate a credential stuffing attack from a single IP targeting multiple accounts."""
        attacker_ip = "198.51.100.42"
        events = []
        targets = [
            ("user_001", "alice@d3vonn.io"),
            ("user_002", "bob@d3vonn.io"),
            ("user_003", "carol@d3vonn.io"),
            ("user_004", "dave@d3vonn.io"),
            ("user_005", "eve@d3vonn.io"),
        ]

        for actor_id, email in targets:
            for attempt in range(5):
                events.append(AttackEvent(
                    source="supabase_auth",
                    event_type="auth.login_failed",
                    severity="medium",
                    actor_id=actor_id,
                    actor_email=email,
                    ip_address=attacker_ip,
                    metadata={"attempt": attempt + 1, "user_agent": "python-requests/2.28"},
                    delay_seconds=0.5,
                ))

        # One success after many failures
        events.append(AttackEvent(
            source="supabase_auth",
            event_type="auth.login_success",
            severity="low",
            actor_id="user_003",
            actor_email="carol@d3vonn.io",
            ip_address=attacker_ip,
            metadata={"after_failures": 5},
            delay_seconds=1.0,
        ))

        return AttackScenario(
            id="scenario_credential_stuffing",
            name="Credential Stuffing Attack",
            description="Single IP attempts login against multiple accounts with eventual success",
            category="authentication",
            events=events,
            expected=ExpectedOutcome(
                alerts_min=3,
                correlations_min=1,
                risk_score_min=60,
                playbook_triggered=True,
                mitre_tactics=["TA0006"],
                mitre_techniques=["T1110.004"],
            ),
            mitre_tactics=["TA0006"],
            mitre_techniques=["T1110.004"],
        )

    @classmethod
    def account_takeover(cls) -> AttackScenario:
        """Simulate account takeover: login from new country, MFA disabled, password changed."""
        events = [
            AttackEvent(
                source="supabase_auth",
                event_type="auth.login_success",
                severity="low",
                actor_id="user_010",
                actor_email="victim@d3vonn.io",
                ip_address="203.0.113.50",
                metadata={"country": "RU", "device_new": True},
                delay_seconds=0.0,
            ),
            AttackEvent(
                source="supabase_auth",
                event_type="auth.mfa_disabled",
                severity="high",
                actor_id="user_010",
                actor_email="victim@d3vonn.io",
                ip_address="203.0.113.50",
                metadata={"previous_mfa": "totp"},
                delay_seconds=2.0,
            ),
            AttackEvent(
                source="supabase_auth",
                event_type="auth.password_changed",
                severity="high",
                actor_id="user_010",
                actor_email="victim@d3vonn.io",
                ip_address="203.0.113.50",
                metadata={"country": "RU"},
                delay_seconds=3.0,
            ),
            AttackEvent(
                source="supabase_auth",
                event_type="auth.email_changed",
                severity="critical",
                actor_id="user_010",
                actor_email="victim@d3vonn.io",
                ip_address="203.0.113.50",
                metadata={"new_email": "attacker@proton.me"},
                delay_seconds=5.0,
            ),
        ]

        return AttackScenario(
            id="scenario_account_takeover",
            name="Account Takeover",
            description="Login from new country → MFA disabled → password changed → email changed",
            category="identity",
            events=events,
            expected=ExpectedOutcome(
                alerts_min=2,
                incidents_min=1,
                correlations_min=1,
                risk_score_min=80,
                playbook_triggered=True,
                mitre_tactics=["TA0006", "TA0003"],
                mitre_techniques=["T1078", "T1098"],
            ),
            mitre_tactics=["TA0006", "TA0003"],
            mitre_techniques=["T1078", "T1098"],
        )

    @classmethod
    def api_abuse(cls) -> AttackScenario:
        """Simulate API abuse: high-volume requests from a single source."""
        events = []
        for i in range(50):
            events.append(AttackEvent(
                source="d3vonn_api",
                event_type="api.rate_limit_exceeded",
                severity="medium",
                actor_id="apikey_malicious",
                actor_email="bot@attacker.com",
                ip_address="192.0.2.100",
                metadata={"endpoint": "/api/v1/data", "requests_per_minute": 500 + i * 10},
                delay_seconds=0.1,
            ))

        return AttackScenario(
            id="scenario_api_abuse",
            name="API Abuse / DDoS Attempt",
            description="Excessive API requests from a single key exceeding rate limits",
            category="api",
            events=events,
            expected=ExpectedOutcome(
                alerts_min=1,
                risk_score_min=50,
                playbook_triggered=True,
                mitre_tactics=["TA0040"],
                mitre_techniques=["T1498"],
            ),
            mitre_tactics=["TA0040"],
            mitre_techniques=["T1498"],
        )

    @classmethod
    def privilege_escalation(cls) -> AttackScenario:
        """Simulate privilege escalation: normal user gains admin role."""
        events = [
            AttackEvent(
                source="supabase_auth",
                event_type="auth.login_success",
                severity="low",
                actor_id="user_020",
                actor_email="normal@d3vonn.io",
                ip_address="10.0.0.5",
                metadata={"role": "user"},
            ),
            AttackEvent(
                source="d3vonn_api",
                event_type="auth.role_changed",
                severity="critical",
                actor_id="user_020",
                actor_email="normal@d3vonn.io",
                ip_address="10.0.0.5",
                metadata={"old_role": "user", "new_role": "admin", "changed_by": "user_020"},
                delay_seconds=5.0,
            ),
            AttackEvent(
                source="d3vonn_api",
                event_type="admin.settings_modified",
                severity="high",
                actor_id="user_020",
                actor_email="normal@d3vonn.io",
                ip_address="10.0.0.5",
                metadata={"setting": "billing_export", "action": "enabled"},
                delay_seconds=10.0,
            ),
        ]

        return AttackScenario(
            id="scenario_privilege_escalation",
            name="Privilege Escalation",
            description="Normal user self-promotes to admin and modifies sensitive settings",
            category="identity",
            events=events,
            expected=ExpectedOutcome(
                alerts_min=1,
                incidents_min=1,
                risk_score_min=75,
                playbook_triggered=True,
                mitre_tactics=["TA0004"],
                mitre_techniques=["T1078.004"],
            ),
            mitre_tactics=["TA0004"],
            mitre_techniques=["T1078.004"],
        )

    @classmethod
    def lateral_movement(cls) -> AttackScenario:
        """Simulate lateral movement across multiple services."""
        events = [
            AttackEvent(
                source="supabase_auth",
                event_type="auth.login_success",
                severity="low",
                actor_id="user_030",
                actor_email="compromised@d3vonn.io",
                ip_address="172.16.0.10",
                metadata={"service": "main_app"},
            ),
            AttackEvent(
                source="d3vonn_api",
                event_type="api.access",
                severity="low",
                actor_id="user_030",
                actor_email="compromised@d3vonn.io",
                ip_address="172.16.0.10",
                metadata={"service": "admin_panel", "first_access": True},
                delay_seconds=30.0,
            ),
            AttackEvent(
                source="d3vonn_api",
                event_type="api.access",
                severity="medium",
                actor_id="user_030",
                actor_email="compromised@d3vonn.io",
                ip_address="172.16.0.10",
                metadata={"service": "database_admin", "first_access": True},
                delay_seconds=60.0,
            ),
            AttackEvent(
                source="d3vonn_api",
                event_type="api.access",
                severity="high",
                actor_id="user_030",
                actor_email="compromised@d3vonn.io",
                ip_address="172.16.0.10",
                metadata={"service": "secrets_manager", "first_access": True},
                delay_seconds=90.0,
            ),
        ]

        return AttackScenario(
            id="scenario_lateral_movement",
            name="Lateral Movement",
            description="Compromised account accesses multiple services in sequence",
            category="network",
            events=events,
            expected=ExpectedOutcome(
                alerts_min=1,
                correlations_min=1,
                risk_score_min=65,
                mitre_tactics=["TA0008"],
                mitre_techniques=["T1021"],
            ),
            mitre_tactics=["TA0008"],
            mitre_techniques=["T1021"],
        )

    @classmethod
    def data_exfiltration(cls) -> AttackScenario:
        """Simulate data exfiltration: large data downloads after hours."""
        events = [
            AttackEvent(
                source="d3vonn_api",
                event_type="data.bulk_export",
                severity="high",
                actor_id="user_040",
                actor_email="insider@d3vonn.io",
                ip_address="10.0.0.50",
                metadata={"records": 50000, "table": "customers", "time": "03:00"},
            ),
            AttackEvent(
                source="d3vonn_api",
                event_type="data.bulk_export",
                severity="high",
                actor_id="user_040",
                actor_email="insider@d3vonn.io",
                ip_address="10.0.0.50",
                metadata={"records": 25000, "table": "transactions", "time": "03:15"},
                delay_seconds=5.0,
            ),
            AttackEvent(
                source="d3vonn_api",
                event_type="data.external_transfer",
                severity="critical",
                actor_id="user_040",
                actor_email="insider@d3vonn.io",
                ip_address="10.0.0.50",
                metadata={"destination": "external_s3", "size_mb": 450},
                delay_seconds=10.0,
            ),
        ]

        return AttackScenario(
            id="scenario_data_exfiltration",
            name="Data Exfiltration",
            description="Bulk data export and external transfer during off-hours",
            category="endpoint",
            events=events,
            expected=ExpectedOutcome(
                alerts_min=2,
                incidents_min=1,
                risk_score_min=85,
                playbook_triggered=True,
                mitre_tactics=["TA0009", "TA0010"],
                mitre_techniques=["T1567", "T1048"],
            ),
            mitre_tactics=["TA0009", "TA0010"],
            mitre_techniques=["T1567", "T1048"],
        )

    @classmethod
    def token_theft(cls) -> AttackScenario:
        """Simulate token theft and reuse from a different IP."""
        events = [
            AttackEvent(
                source="supabase_auth",
                event_type="auth.token_reuse",
                severity="high",
                actor_id="user_050",
                actor_email="target@d3vonn.io",
                ip_address="45.33.32.156",
                metadata={"original_ip": "10.0.0.1", "token_age_hours": 2},
            ),
            AttackEvent(
                source="d3vonn_api",
                event_type="api.access",
                severity="medium",
                actor_id="user_050",
                actor_email="target@d3vonn.io",
                ip_address="45.33.32.156",
                metadata={"endpoint": "/api/v1/admin/users"},
                delay_seconds=2.0,
            ),
        ]

        return AttackScenario(
            id="scenario_token_theft",
            name="Token Theft & Reuse",
            description="Stolen token used from attacker IP to access admin endpoints",
            category="authentication",
            events=events,
            expected=ExpectedOutcome(
                alerts_min=1,
                risk_score_min=70,
                playbook_triggered=True,
                mitre_tactics=["TA0006"],
                mitre_techniques=["T1528"],
            ),
            mitre_tactics=["TA0006"],
            mitre_techniques=["T1528"],
        )

    @classmethod
    def insider_threat(cls) -> AttackScenario:
        """Simulate insider threat: admin accessing data outside normal patterns."""
        events = [
            AttackEvent(
                source="d3vonn_api",
                event_type="admin.bulk_user_export",
                severity="high",
                actor_id="admin_001",
                actor_email="admin@d3vonn.io",
                ip_address="10.0.0.1",
                metadata={"records": 10000, "time": "02:30", "normal_hours": "09:00-18:00"},
            ),
            AttackEvent(
                source="d3vonn_api",
                event_type="admin.api_key_created",
                severity="high",
                actor_id="admin_001",
                actor_email="admin@d3vonn.io",
                ip_address="10.0.0.1",
                metadata={"key_scope": "full_access", "expiry": "never"},
                delay_seconds=5.0,
            ),
            AttackEvent(
                source="d3vonn_api",
                event_type="admin.audit_log_cleared",
                severity="critical",
                actor_id="admin_001",
                actor_email="admin@d3vonn.io",
                ip_address="10.0.0.1",
                metadata={"logs_deleted": 5000},
                delay_seconds=10.0,
            ),
        ]

        return AttackScenario(
            id="scenario_insider_threat",
            name="Insider Threat",
            description="Admin exports data, creates persistent access, and clears audit logs",
            category="identity",
            events=events,
            expected=ExpectedOutcome(
                alerts_min=2,
                incidents_min=1,
                correlations_min=1,
                risk_score_min=90,
                playbook_triggered=True,
                mitre_tactics=["TA0009", "TA0005"],
                mitre_techniques=["T1530", "T1070"],
            ),
            mitre_tactics=["TA0009", "TA0005"],
            mitre_techniques=["T1530", "T1070"],
        )

    @classmethod
    def supply_chain_attack(cls) -> AttackScenario:
        """Simulate supply chain attack via compromised dependency."""
        events = [
            AttackEvent(
                source="github_security",
                event_type="dependency.vulnerability_detected",
                severity="critical",
                actor_id="system",
                actor_email="dependabot@github.com",
                ip_address="0.0.0.0",
                metadata={"package": "malicious-lib", "cve": "CVE-2026-99999", "severity": "critical"},
            ),
            AttackEvent(
                source="d3vonn_api",
                event_type="deploy.package_installed",
                severity="high",
                actor_id="ci_pipeline",
                actor_email="ci@d3vonn.io",
                ip_address="10.0.0.200",
                metadata={"package": "malicious-lib@1.2.3", "environment": "production"},
                delay_seconds=5.0,
            ),
            AttackEvent(
                source="d3vonn_api",
                event_type="network.outbound_connection",
                severity="critical",
                actor_id="service_worker",
                actor_email="system@d3vonn.io",
                ip_address="10.0.0.200",
                metadata={"destination": "evil-c2.example.com", "port": 443},
                delay_seconds=30.0,
            ),
        ]

        return AttackScenario(
            id="scenario_supply_chain",
            name="Supply Chain Attack",
            description="Compromised dependency installed in production, initiates C2 connection",
            category="cloud",
            events=events,
            expected=ExpectedOutcome(
                alerts_min=2,
                incidents_min=1,
                risk_score_min=90,
                playbook_triggered=True,
                mitre_tactics=["TA0001", "TA0011"],
                mitre_techniques=["T1195.002", "T1071"],
            ),
            mitre_tactics=["TA0001", "TA0011"],
            mitre_techniques=["T1195.002", "T1071"],
        )

    @classmethod
    def ransomware_precursor(cls) -> AttackScenario:
        """Simulate ransomware precursor activity."""
        events = [
            AttackEvent(
                source="d3vonn_api",
                event_type="endpoint.shadow_copy_deleted",
                severity="critical",
                actor_id="user_060",
                actor_email="compromised_host@d3vonn.io",
                ip_address="10.0.0.75",
                metadata={"action": "vssadmin delete shadows"},
            ),
            AttackEvent(
                source="d3vonn_api",
                event_type="endpoint.encryption_activity",
                severity="critical",
                actor_id="user_060",
                actor_email="compromised_host@d3vonn.io",
                ip_address="10.0.0.75",
                metadata={"files_encrypted": 150, "extension": ".locked"},
                delay_seconds=10.0,
            ),
            AttackEvent(
                source="d3vonn_api",
                event_type="network.tor_connection",
                severity="critical",
                actor_id="user_060",
                actor_email="compromised_host@d3vonn.io",
                ip_address="10.0.0.75",
                metadata={"destination": "tor_exit_node", "port": 9001},
                delay_seconds=15.0,
            ),
        ]

        return AttackScenario(
            id="scenario_ransomware",
            name="Ransomware Precursor",
            description="Shadow copy deletion, file encryption, and Tor C2 communication",
            category="endpoint",
            events=events,
            expected=ExpectedOutcome(
                alerts_min=3,
                incidents_min=1,
                risk_score_min=95,
                playbook_triggered=True,
                mitre_tactics=["TA0040", "TA0011"],
                mitre_techniques=["T1490", "T1486"],
            ),
            mitre_tactics=["TA0040", "TA0011"],
            mitre_techniques=["T1490", "T1486"],
        )
