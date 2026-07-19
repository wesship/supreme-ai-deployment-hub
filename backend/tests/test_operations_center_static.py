from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROUTER = ROOT / "backend" / "api" / "v1" / "router.py"
AGENT = ROOT / "scripts" / "ops" / "d3vonn_ops_agent.py"
BACKUP = ROOT / "scripts" / "ops" / "backup_production_config.sh"
MIGRATION = ROOT / "supabase" / "migrations" / "20260719090000_d3vonn_operations_center.sql"
WORKFLOW = ROOT / ".github" / "workflows" / "d3vonn-operations-verification.yml"


def test_unified_health_and_incident_routes_exist():
    text = ROUTER.read_text(encoding="utf-8")
    assert '@router.get("/ops/health"' in text
    assert '@router.get("/ops/incidents"' in text
    assert '@router.post("/ops/remediations"' in text
    assert "OPS_ADMIN_TOKEN" in text


def test_protected_actions_require_approval():
    text = ROUTER.read_text(encoding="utf-8")
    for action in (
        "apply_database_migration",
        "rotate_production_secret",
        "merge_main",
        "deploy_production",
        "change_firewall_policy",
    ):
        assert action in text
    assert 'approval_status = "pending"' in text


def test_agent_is_allowlisted_and_opt_in():
    text = AGENT.read_text(encoding="utf-8")
    assert "ALLOWED_CONTAINERS" in text
    assert "OPS_AUTO_REMEDIATE" in text
    assert 'docker", "restart"' in text
    assert "shell=True" not in text


def test_backup_requires_encryption_for_environment_files():
    text = BACKUP.read_text(encoding="utf-8")
    assert "AGE_RECIPIENT" in text
    assert "age --recipient" in text
    assert "Never archive plaintext .env files" in text


def test_operations_schema_enables_rls():
    text = MIGRATION.read_text(encoding="utf-8")
    for table in (
        "ops_health_checks",
        "ops_incidents",
        "ops_alerts",
        "ops_remediations",
        "ops_approvals",
        "ops_audit_events",
    ):
        assert f"alter table public.{table} enable row level security" in text


def test_continuous_verification_covers_tls_latency_5xx_and_schema():
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "ssl_verify_result" in text
    assert "latency threshold exceeded" in text
    assert '"$code" -lt 500' in text
    assert "dashboard_schema_readiness" in text
    assert "environment: production" in text
