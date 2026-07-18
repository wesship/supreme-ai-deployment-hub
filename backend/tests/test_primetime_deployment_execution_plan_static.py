from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

DEPLOYMENT_PLAN = ROOT / "docs" / "PRIMETIME_DEPLOYMENT_EXECUTION_PLAN.md"
ENV_MATRIX = ROOT / "docs" / "PRIMETIME_ENVIRONMENT_MATRIX.md"
MIGRATION_ORDER = ROOT / "docs" / "PRIMETIME_MIGRATION_ORDER_CHECKLIST.md"


def read(path: Path) -> str:
    assert path.exists(), f"Missing required deployment artifact: {path}"
    return path.read_text(encoding="utf-8")


def test_deployment_execution_artifacts_exist():
    assert DEPLOYMENT_PLAN.exists()
    assert ENV_MATRIX.exists()
    assert MIGRATION_ORDER.exists()


def test_release_stack_and_merge_order_documented():
    content = read(DEPLOYMENT_PLAN)
    for pr in ["#434", "#435", "#436", "#437", "#440", "#441", "#442", "#444"]:
        assert pr in content
    assert "No release is deployed out of stack order" in content
    assert "Merge order approved" in content


def test_production_boundaries_documented():
    content = read(DEPLOYMENT_PLAN)
    required = [
        "No communication without consent check",
        "No AI execution without audit",
        "No regulated recommendation without licensed human review",
        "No autonomous outbound sales calling",
        "No quote generation endpoint",
        "No policy recommendation endpoint",
        "No application submission endpoint",
        "No hard delete for regulated records",
        "No sensitive export without authorization",
    ]
    for boundary in required:
        assert boundary in content


def test_blocked_endpoint_fragments_documented():
    content = read(DEPLOYMENT_PLAN)
    for fragment in ["/send", "/quote", "/recommend-policy", "/submit-application"]:
        assert fragment in content
    assert "No PRIMETIME DELETE endpoint" in content


def test_environment_matrix_protects_secrets():
    content = read(ENV_MATRIX)
    assert "SUPABASE_SERVICE_ROLE_KEY" in content
    assert "Backend only; never frontend" in content
    assert "No service-role key in frontend code" in content
    assert "No production secret committed to repository" in content


def test_required_routes_are_in_smoke_tests():
    content = read(ENV_MATRIX)
    for route in [
        "/primetime",
        "/primetime/scheduling",
        "/primetime/communications",
        "/primetime/ai-assistance",
        "/primetime/executive-command-center",
    ]:
        assert route in content


def test_migration_order_is_chronological():
    content = read(MIGRATION_ORDER)
    expected_order = [
        "20260718150000_primetime_release1_crm_foundation.sql",
        "20260718151500_primetime_release1_enforcement.sql",
        "20260718162000_primetime_release2_scheduling.sql",
        "20260718170000_primetime_release3_communications.sql",
        "20260718173000_primetime_release4_ai_assistance.sql",
        "20260718180000_primetime_release5_analytics_command_center.sql",
    ]
    positions = [content.index(item) for item in expected_order]
    assert positions == sorted(positions)


def test_owner_signoff_and_rollback_are_required():
    content = read(DEPLOYMENT_PLAN)
    assert "Final Sign-Off Table" in content
    for owner in [
        "Release Manager",
        "Database Owner",
        "Backend Owner",
        "Frontend Owner",
        "Compliance Reviewer",
        "Security Owner",
        "Operations Owner",
        "Business Owner",
    ]:
        assert owner in content
    assert "Rollback Procedure" in content
    assert "Production Go/No-Go Gate" in content
