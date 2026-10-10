from pathlib import Path


MIGRATION = Path(
    "supabase/migrations/20260725172000_approval_queue_exactly_once.sql"
)


def migration_sql() -> str:
    return MIGRATION.read_text(encoding="utf-8").lower()


def test_approval_audit_ledger_is_unique_and_backend_only() -> None:
    sql = migration_sql()
    assert "create table if not exists public.approval_queue_audit" in sql
    assert "approval_id uuid not null unique" in sql
    assert "enable row level security" in sql
    assert "revoke all on table public.approval_queue_audit from public, anon, authenticated" in sql
    assert "grant select, insert on table public.approval_queue_audit to service_role" in sql


def test_terminal_approval_decisions_are_immutable() -> None:
    sql = migration_sql()
    assert "if old.status in ('approved', 'rejected')" in sql
    assert "errcode = '55000'" in sql
    assert "old.status = 'pending' and new.status in ('approved', 'rejected')" in sql
    assert "new.reviewed_at := clock_timestamp()" in sql


def test_review_is_a_single_atomic_transition_with_audit() -> None:
    sql = migration_sql()
    assert "insert into public.approval_queue_audit" in sql
    assert "before update of status, reviewed_by, review_note, reviewed_at" in sql
    assert "create trigger approval_queue_exactly_once_review" in sql
    assert "set search_path = pg_catalog, public" in sql
    assert "revoke all on function public.enforce_approval_queue_exactly_once() from public, anon, authenticated" in sql
