from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RECOVERY = ROOT / "supabase/migrations/20260721141622_restore_primetime_governed_runtime_schema.sql"
PREFLIGHT = ROOT / "supabase/migrations/20260718162900_primetime_release4_audit_compatibility.sql"

ROUTERS = [
    ROOT / "backend/app/routers/primetime_release1.py",
    ROOT / "backend/app/routers/primetime_release2_scheduling.py",
    ROOT / "backend/app/routers/primetime_release3_communications.py",
    ROOT / "backend/app/routers/primetime_release4_ai_assistance.py",
    ROOT / "backend/app/routers/primetime_release5_analytics.py",
]


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_all_primetime_routers_map_canonical_release1_tables() -> None:
    for router in ROUTERS:
        source = read(router)
        assert "_TABLE_NAMES" in source
        assert '"primetime_workspace_memberships"' in source or 'f"primetime_{table}"' in source
        assert "_TABLE_NAMES.get(table, table)" in source
        assert "roles:primetime_roles(code)" in source
        assert 'role.get("code", "representative")' in source
        assert "roles:primetime_roles(name)" not in source
        assert 'role.get("name", "representative")' not in source


def test_release1_schema_matches_the_public_api_contract() -> None:
    sql = read(RECOVERY)
    for token in [
        "slug text",
        "owner_id uuid not null",
        "priority text not null",
        "rename column actor_user_id to actor_id",
        "consent_state in ('unknown'",
        "recorded_by uuid",
        "rename column event_type to action",
        "metadata jsonb not null",
    ]:
        assert token in sql


def test_release2_schema_matches_scheduling_payloads() -> None:
    sql = read(RECOVERY)
    for token in [
        "appointment_type text not null",
        "start_at timestamptz not null",
        "end_at timestamptz not null",
        "attendee_role text not null",
        "rule_name text not null",
        "recipient_person_id uuid",
        "policy_check_state text not null",
        "external_calendar_id text",
        "authoritative boolean not null default false",
    ]:
        assert token in sql


def test_release3_schema_matches_communications_payloads() -> None:
    sql = read(RECOVERY)
    for token in [
        "version integer not null",
        "preference_state text not null",
        "scheduled_at timestamptz",
        "blocked_reason text",
        "recorded_by uuid",
        "decision text not null",
        "checks jsonb not null",
        "reasons text[] not null",
    ]:
        assert token in sql


def test_release4_schema_matches_ai_assistance_payloads() -> None:
    sql = read(RECOVERY)
    for token in [
        "key text not null",
        "system_prompt text not null",
        "agent_key text not null",
        "context jsonb not null",
        "content jsonb not null",
        "action_status text not null",
        "review_type text not null",
        "source_url text",
    ]:
        assert token in sql
    assert "new.action_status := 'blocked'" in sql
    assert "primetime_seed_ai_agents_for_workspace" in sql


def test_release4_preflight_uses_the_canonical_bigint_audit_key() -> None:
    sql = read(PREFLIGHT)
    assert "audit_event_id bigint references public.primetime_audit_events(id)" in sql
