from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROUTER = ROOT / "backend" / "app" / "routers" / "primetime_release7_observability.py"
MAIN = ROOT / "backend" / "main.py"
MIGRATION = ROOT / "supabase" / "migrations" / "20260817200000_primetime_release7_advanced_telemetry.sql"
PLAN = ROOT / "docs" / "PRIMETIME_RELEASE7_ADVANCED_TELEMETRY_PLAN.md"
GATES = ROOT / "config" / "primetime-release7-gates.json"
CLIENT = ROOT / "src" / "lib" / "primetimeRelease1Api.ts"
APP = ROOT / "src" / "App.tsx"
PAGE = ROOT / "src" / "pages" / "PrimetimeObservability.tsx"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_release7_required_artifacts_exist() -> None:
    for path in [ROUTER, MAIN, MIGRATION, PLAN, GATES, CLIENT, APP, PAGE]:
        assert path.exists(), f"Missing Release 7 artifact: {path}"


def test_release7_router_is_mounted_in_main() -> None:
    main = read(MAIN)
    assert "primetime_release7_observability" in main
    assert "app.include_router(primetime_release7_observability_router)" in main
    assert "PRIMETIME Release 7 observability router registered at /primetime/v1" in main


def test_release7_router_declares_governed_telemetry_tables_and_routes() -> None:
    source = read(ROUTER)
    for table in ["telemetry_signals", "slo_definitions", "slo_evaluations", "telemetry_alerts", "audit_events"]:
        assert table in source
    for route in [
        '@router.get("/observability/signals")',
        '@router.post("/observability/signals")',
        '@router.get("/observability/slos")',
        '@router.post("/observability/slos")',
        '@router.patch("/observability/slos/{slo_id}")',
        '@router.get("/observability/evaluations")',
        '@router.post("/observability/evaluations")',
        '@router.get("/observability/alerts")',
        '@router.post("/observability/evaluations/{evaluation_id}/alerts")',
        '@router.patch("/observability/alerts/{alert_id}")',
        '@router.get("/observability/overview")',
    ]:
        assert route in source


def test_release7_router_preserves_observability_boundaries() -> None:
    source = read(ROUTER)
    for forbidden in ["@router.delete", "/send", "/quote", "/recommend-policy", "/submit-application", "ai_action_ledger\", {", "communications\", {", "leads\", {"]:
        assert forbidden not in source
    assert "No DELETE endpoints are exposed" in source
    assert "Release 7 cannot mutate business records" in source
    assert "_MUTATION_TABLES" in source
    assert "table not in _MUTATION_TABLES" in source


def test_release7_router_enforces_safe_telemetry_values_and_alert_lifecycle() -> None:
    source = read(ROUTER)
    for required in [
        "_validate_dimensions",
        "_FORBIDDEN_DIMENSION_KEYS",
        "value must be finite",
        "measured_value must be finite",
        "warning_threshold must be lower than target_value for lte SLOs",
        "warning_threshold must be higher than target_value for gte SLOs",
        "Compliant SLO evaluations cannot open telemetry alerts",
        "Resolved or silenced alerts cannot be reopened through Release 7",
        "_evaluate_slo",
    ]:
        assert required in source


def test_release7_router_enforces_membership_role_gates_and_audits() -> None:
    source = read(ROUTER)
    for required in ["_membership_required", "_require_role", "_READ_ROLES", "_TELEMETRY_WRITE_ROLES", "_ALERT_LIFECYCLE_ROLES"]:
        assert required in source
    for action in [
        "telemetry_signal.recorded",
        "telemetry_slo.created",
        "telemetry_slo.updated",
        "telemetry_slo.evaluated",
        "telemetry_alert.opened",
        "telemetry_alert.lifecycle_updated",
    ]:
        assert action in source


def test_release7_migration_enforces_rls_indexes_and_history_immutability() -> None:
    migration = read(MIGRATION)
    for table in ["primetime_telemetry_signals", "primetime_slo_definitions", "primetime_slo_evaluations", "primetime_telemetry_alerts"]:
        assert f"alter table public.{table} enable row level security" in migration
    for required in [
        "primetime_release7_safe_dimensions",
        "primetime_release7_prevent_history_mutation",
        "primetime_release7_prevent_delete",
        "trg_primetime_telemetry_signals_immutable",
        "trg_primetime_slo_evaluations_immutable",
        "trg_primetime_slo_definitions_no_delete",
        "trg_primetime_telemetry_alerts_no_delete",
        "on delete restrict",
    ]:
        assert required in migration
    assert "on delete cascade" not in migration


def test_release7_frontend_routes_and_client_contract_are_present() -> None:
    app = read(APP)
    client = read(CLIENT)
    page = read(PAGE)
    for route in ['path="/primetime/observability"', 'path="/primetime/release-7"']:
        assert route in app
    for endpoint in [
        "/primetime/v1/observability/overview",
        "/primetime/v1/observability/signals",
        "/primetime/v1/observability/slos",
        "/primetime/v1/observability/evaluations",
        "/primetime/v1/observability/alerts",
    ]:
        assert endpoint in client
    for required in ["Advanced Telemetry &amp; Observability", "Record governed signal", "Create SLO contract", "Alert lifecycle"]:
        assert required in page


def test_release7_gate_configuration_requires_production_safeguards() -> None:
    gates = read(GATES)
    for required in [
        '"requires_release6_staging_gate": true',
        '"requires_compliance_signoff": true',
        '"requires_rollback_plan": true',
        '"forbid_customer_payloads": true',
        '"forbid_credentials_and_tokens": true',
        '"no_autonomous_remediation": true',
        '"DELETE"',
        '"/primetime/release-7"',
    ]:
        assert required in gates


def test_release7_plan_documents_staging_and_compliance_requirements() -> None:
    plan = read(PLAN)
    for required in [
        "No `DELETE` endpoint is exposed",
        "No customer payloads",
        "Release 6 staging gate",
        "compliance signoff",
        "rollback plan",
    ]:
        assert required in plan
