from pathlib import Path


MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "supabase"
    / "migrations"
    / "20260728234000_approval_queue_audit_service_policy.sql"
)


def test_approval_queue_audit_remains_service_only() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "enable row level security" in sql
    assert "revoke all on table public.approval_queue_audit from public, anon, authenticated" in sql
    assert "grant select, insert on table public.approval_queue_audit to service_role" in sql
    assert "to service_role" in sql
    assert "using (true)" in sql
    assert "with check (true)" in sql


def test_policy_does_not_grant_browser_roles() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "grant" not in sql.split("to service_role")[0].split("revoke all")[-1]
    assert "to anon" not in sql
    assert "to authenticated" not in sql
