from pathlib import Path


MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "supabase"
    / "migrations"
    / "20260723001500_capture_production_schema_drift.sql"
)

TABLES = {
    "approval_requests",
    "rag_document_logs",
    "approval_queue",
    "rag_documents",
}


def _sql() -> str:
    return MIGRATION.read_text(encoding="utf-8")


def test_schema_drift_migration_is_append_only() -> None:
    assert MIGRATION.exists()
    assert MIGRATION.name.startswith("20260723001500_")


def test_all_drifted_tables_are_reproducible() -> None:
    sql = _sql().lower()
    for table in TABLES:
        assert f"create table if not exists public.{table}" in sql
        assert f"alter table public.{table} enable row level security" in sql


def test_legacy_tables_are_explicitly_backend_only() -> None:
    sql = _sql().lower()
    for table in {"approval_requests", "rag_document_logs"}:
        assert f"revoke all privileges on table public.{table} from public, anon, authenticated" in sql
        assert f"grant all privileges on table public.{table} to service_role" in sql
    assert sql.count("for all to anon, authenticated using (false) with check (false)") == 2


def test_active_tables_preserve_owner_flows_and_correct_admin_claim() -> None:
    sql = _sql().lower()
    assert "grant select, insert on table public.approval_queue to authenticated" in sql
    assert "grant select, insert on table public.rag_documents to authenticated" in sql
    assert sql.count("auth.jwt()->'app_metadata'->>'role'") >= 4
    assert "auth.jwt() ->> 'role'" not in sql
    assert "auth.jwt()->>'role'" not in sql
    assert sql.count("with check (auth.uid() = user_id)") == 2
    assert sql.count("using (auth.uid() = user_id or") == 2


def test_migration_is_transactional_and_idempotent() -> None:
    sql = _sql().lower()
    assert sql.startswith("begin;")
    assert sql.rstrip().endswith("commit;")
    assert "create index if not exists" in sql
    assert "drop policy if exists" in sql
