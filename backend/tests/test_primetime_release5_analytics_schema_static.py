from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "20260718180000_primetime_release5_analytics_command_center.sql"
PLAN = ROOT / "docs" / "PRIMETIME_RELEASE5_ANALYTICS_COMMAND_CENTER_PLAN.md"
CONTRACT = ROOT / "docs" / "PRIMETIME_RELEASE5_API_CONTRACT.md"


def _read(path: Path) -> str:
    assert path.exists(), f"Missing expected file: {path}"
    return path.read_text(encoding="utf-8")


def test_release5_schema_tables_exist():
    sql = _read(MIGRATION)
    expected_tables = [
        "analytics_metric_definitions",
        "executive_dashboards",
        "dashboard_widgets",
        "analytics_snapshots",
        "funnel_stage_snapshots",
        "agent_performance_snapshots",
        "compliance_metric_snapshots",
        "ai_action_metric_snapshots",
        "release_governance_observations",
    ]
    for table in expected_tables:
        assert f"create table if not exists public.{table}" in sql
        assert f"alter table public.{table} enable row level security" in sql


def test_release5_schema_has_command_center_metrics():
    sql = _read(MIGRATION)
    for metric in [
        "funnel",
        "scheduling",
        "communications",
        "ai_actions",
        "compliance",
        "release_governance",
        "executive",
    ]:
        assert metric in sql


def test_release5_snapshot_guardrails_exist():
    sql = _read(MIGRATION)
    assert "check (period_start < period_end)" in sql
    assert "conversion_rate >= 0 and conversion_rate <= 1" in sql
    assert "compliance_score >= 0 and compliance_score <= 100" in sql
    assert "score >= 0 and score <= 100" in sql
    assert "lead_count >= 0" in sql
    assert "blocked_ai_action_count >= 0" in sql


def test_release5_schema_has_indexes_and_updated_at_triggers():
    sql = _read(MIGRATION)
    assert "idx_analytics_snapshots_workspace_metric" in sql
    assert "idx_funnel_stage_snapshots_workspace_date" in sql
    assert "idx_agent_performance_workspace_date" in sql
    assert "idx_release_governance_observations_status" in sql
    assert "primetime_release5_touch_updated_at" in sql
    assert "trg_executive_dashboards_updated_at" in sql
    assert "trg_dashboard_widgets_updated_at" in sql


def test_release5_docs_define_governance_boundaries():
    plan = _read(PLAN)
    contract = _read(CONTRACT)
    for phrase in [
        "No DELETE endpoints",
        "Autonomous AI execution",
        "Quote generation",
        "Communication sending",
        "Bypassing workspace membership",
    ]:
        assert phrase in plan
    for endpoint in [
        "GET /analytics/metric-definitions",
        "POST /analytics/dashboards",
        "PATCH /analytics/widgets/{widget_id}",
        "GET /analytics/release-governance-observations",
    ]:
        assert endpoint in contract
    assert "Analytics endpoints may record snapshots but must not mutate business records" in contract
