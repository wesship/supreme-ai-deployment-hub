from pathlib import Path

MIGRATION = Path("supabase/migrations/20260718163000_primetime_release4_ai_assistance.sql")
PLAN = Path("docs/PRIMETIME_RELEASE4_AI_ASSISTANCE_PLAN.md")
CONTRACT = Path("docs/PRIMETIME_RELEASE4_API_CONTRACT.md")


def test_release4_migration_exists():
    assert MIGRATION.exists()


def test_release4_tables_exist():
    text = MIGRATION.read_text()
    for table in [
        "ai_agents",
        "ai_agent_versions",
        "ai_assistance_requests",
        "ai_assistance_outputs",
        "ai_action_ledger",
        "ai_approval_requests",
        "ai_compliance_findings",
        "ai_knowledge_citations",
    ]:
        assert f"create table if not exists public.{table}" in text
        assert f"alter table public.{table} enable row level security" in text


def test_release4_blocks_autonomous_regulated_actions():
    text = MIGRATION.read_text().lower()
    for blocked in [
        "regulated_recommendation",
        "quote",
        "policy_decision",
        "submit_application",
        "autonomous_send",
        "send_message",
        "place_call",
        "delete_record",
    ]:
        assert blocked in text
    assert "primetime_block_autonomous_regulated_ai_actions" in text
    assert "action_status := 'blocked'" in text


def test_release4_approval_controls_exist():
    text = MIGRATION.read_text().lower()
    assert "ai_approval_requests" in text
    assert "licensed_review" in text
    assert "compliance_review" in text
    assert "decided_approvals_require_reviewer" in text
    assert "decided_by is not null" in text


def test_release4_audit_event_exists():
    text = MIGRATION.read_text().lower()
    assert "primetime_ai_action_audit_event" in text
    assert "insert into public.primetime_audit_events" in text
    assert "ai.action." in text


def test_release4_seed_agents_exist():
    text = MIGRATION.read_text()
    for agent_key in [
        "intake_agent",
        "follow_up_agent",
        "scheduling_agent",
        "meeting_prep_agent",
        "compliance_reviewer_agent",
    ]:
        assert agent_key in text


def test_release4_plan_and_contract_document_boundaries():
    plan = PLAN.read_text().lower()
    contract = CONTRACT.read_text().lower()
    for forbidden in ["autonomous", "regulated", "quote", "delete", "send"]:
        assert forbidden in plan
        assert forbidden in contract
    assert "post /primetime/v1/ai/send" in contract
    assert "delete /primetime/v1/ai/*" in contract
