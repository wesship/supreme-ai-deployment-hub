from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROUTER = ROOT / "backend" / "app" / "routers" / "primetime_release5_analytics.py"
MAIN = ROOT / "backend" / "main.py"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_release5_router_is_mounted_in_main() -> None:
    main = read(MAIN)
    assert "primetime_release5_analytics" in main
    assert "PRIMETIME Release 5 analytics router registered at /primetime/v1" in main
    assert "app.include_router(primetime_release5_analytics_router)" in main


def test_release5_router_declares_governed_prefix_and_tables() -> None:
    source = read(ROUTER)
    assert "APIRouter(prefix=\"/primetime/v1\"" in source
    for table in [
        "analytics_metric_definitions",
        "executive_dashboards",
        "dashboard_widgets",
        "analytics_snapshots",
        "funnel_stage_snapshots",
        "agent_performance_snapshots",
        "compliance_metric_snapshots",
        "ai_action_metric_snapshots",
        "release_governance_observations",
        "audit_events",
    ]:
        assert table in source
    assert "_MUTATION_TABLES" in source
    assert "Release 5 cannot mutate business records" in source


def test_release5_runtime_endpoints_are_present() -> None:
    source = read(ROUTER)
    expected_routes = [
        '@router.get("/analytics/metric-definitions")',
        '@router.post("/analytics/metric-definitions")',
        '@router.patch("/analytics/metric-definitions/{metric_definition_id}")',
        '@router.get("/analytics/executive-dashboards")',
        '@router.post("/analytics/executive-dashboards")',
        '@router.patch("/analytics/executive-dashboards/{dashboard_id}")',
        '@router.get("/analytics/dashboard-widgets")',
        '@router.post("/analytics/dashboard-widgets")',
        '@router.patch("/analytics/dashboard-widgets/{widget_id}")',
        '@router.get("/analytics/snapshots")',
        '@router.post("/analytics/snapshots")',
        '@router.get("/analytics/funnel-stage-snapshots")',
        '@router.post("/analytics/funnel-stage-snapshots")',
        '@router.get("/analytics/agent-performance-snapshots")',
        '@router.post("/analytics/agent-performance-snapshots")',
        '@router.get("/analytics/compliance-metric-snapshots")',
        '@router.post("/analytics/compliance-metric-snapshots")',
        '@router.get("/analytics/ai-action-metric-snapshots")',
        '@router.post("/analytics/ai-action-metric-snapshots")',
        '@router.get("/analytics/release-governance-observations")',
        '@router.post("/analytics/release-governance-observations")',
        '@router.patch("/analytics/release-governance-observations/{observation_id}")',
    ]
    for route in expected_routes:
        assert route in source


def test_release5_governance_boundaries_are_preserved() -> None:
    source = read(ROUTER)
    forbidden = [
        "@router.delete",
        "/send",
        "/quote",
        "/recommend-policy",
        "/submit-application",
        "ai_action_ledger\", {",
        "communications\", {",
        "leads\", {",
        "appointments\", {",
    ]
    for token in forbidden:
        assert token not in source
    assert "observation-only" in source
    assert "It does not mutate CRM" in source
    assert "_path(table, mutate=True)" in source
    assert "table not in _MUTATION_TABLES" in source


def test_release5_role_gates_and_audit_writes_are_present() -> None:
    source = read(ROUTER)
    assert "_READ_ROLES" in source
    assert "_ANALYTICS_WRITE_ROLES" in source
    assert "_EXECUTIVE_WRITE_ROLES" in source
    assert "_GOVERNANCE_WRITE_ROLES" in source
    assert "_membership_required" in source
    assert "_require_role" in source
    for action in [
        "analytics_metric_definition.created",
        "analytics_metric_definition.updated",
        "executive_dashboard.created",
        "executive_dashboard.updated",
        "dashboard_widget.created",
        "dashboard_widget.updated",
        "analytics_snapshot.created",
        "funnel_stage_snapshot.created",
        "agent_performance_snapshot.created",
        "compliance_metric_snapshot.created",
        "ai_action_metric_snapshot.created",
        "release_governance_observation.created",
        "release_governance_observation.updated",
    ]:
        assert action in source


def test_release5_validation_models_lock_metric_ranges() -> None:
    source = read(ROUTER)
    assert "period_start must be before period_end" in source
    assert "conversion_rate: float | None = Field(default=None, ge=0, le=1)" in source
    assert "score: float | None = Field(default=None, ge=0, le=100)" in source
    assert "compliance_score: float | None = Field(default=None, ge=0, le=100)" in source
    assert "automation_savings_minutes: float | None = Field(default=None, ge=0)" in source
