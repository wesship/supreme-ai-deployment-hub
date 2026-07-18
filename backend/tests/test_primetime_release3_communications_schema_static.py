from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "20260718170000_primetime_release3_communications.sql"
PLAN = ROOT / "docs" / "PRIMETIME_RELEASE3_COMMUNICATIONS_PLAN.md"
CONTRACT = ROOT / "docs" / "PRIMETIME_RELEASE3_API_CONTRACT.md"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_release3_migration_exists():
    assert MIGRATION.exists()


def test_release3_core_tables_exist():
    sql = read(MIGRATION)
    for table in [
        "message_templates",
        "message_template_versions",
        "communication_preferences",
        "communication_frequency_counters",
        "communications",
        "communication_events",
        "communication_policy_checks",
    ]:
        assert f"create table if not exists {table}" in sql


def test_release3_channels_and_lifecycle_states_are_constrained():
    sql = read(MIGRATION)
    for channel in ["email", "sms", "voice", "mail", "in_person"]:
        assert channel in sql
    for status in ["draft", "pending_review", "approved", "scheduled", "sent", "delivered", "failed", "responded", "opted_out", "blocked"]:
        assert status in sql


def test_release3_enforces_template_approval_consent_and_suppression():
    sql = read(MIGRATION)
    assert "primetime_block_unapproved_outbound_communications" in sql
    assert "Outbound communication requires approved template" in sql
    assert "Outbound communication blocked by suppression record" in sql
    assert "Outbound communication requires consent or not-required attestation" in sql
    assert "communications_requires_approval_before_send" in sql


def test_release3_logs_communication_lifecycle_events():
    sql = read(MIGRATION)
    assert "primetime_log_communication_event" in sql
    assert "communications_log_event" in sql
    assert "communication_events" in sql
    for event in ["created", "approved", "blocked", "scheduled", "sent", "delivered", "failed", "responded", "opted_out", "cancelled"]:
        assert event in sql


def test_release3_rls_enabled_for_all_tables():
    sql = read(MIGRATION)
    for table in [
        "message_templates",
        "message_template_versions",
        "communication_preferences",
        "communication_frequency_counters",
        "communications",
        "communication_events",
        "communication_policy_checks",
    ]:
        assert f"alter table {table} enable row level security" in sql


def test_release3_plan_and_contract_document_no_autonomous_sending():
    plan = read(PLAN)
    contract = read(CONTRACT)
    assert "does not send messages autonomously" in plan
    assert "No `/send` endpoint" in contract
    assert "No DELETE endpoint" in contract
    assert "Autonomous outbound delivery" in contract
