from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RESTORE = ROOT / "supabase" / "migrations" / "20260725225100_restore_hermes_runtime_ledger.sql"


def test_restore_migration_is_timestamped_and_present() -> None:
    assert RESTORE.exists()
    assert RESTORE.name[:14].isdigit()


def test_restore_recreates_the_missing_hermes_runtime_tables() -> None:
    sql = RESTORE.read_text(encoding="utf-8").lower()

    for table_name in (
        "hermes_runs",
        "hermes_logs",
        "hermes_memory",
        "hermes_followups",
        "agent_registry",
    ):
        assert f"create table if not exists public.{table_name}" in sql
        assert f"alter table public.{table_name} enable row level security" in sql
        assert f'policy "{table_name}_select"' in sql


def test_restore_reconciles_task_columns_and_update_triggers() -> None:
    sql = RESTORE.read_text(encoding="utf-8").lower()

    for column_name in ("agent_name", "assigned_to", "priority", "retry_count", "locked_at"):
        assert f"alter table public.hermes_tasks add column if not exists {column_name}" in sql

    assert "create or replace function public.set_updated_at()" in sql
    assert "foreach table_name in array array['hermes_memory', 'hermes_followups', 'agent_registry']" in sql
    assert "create trigger set_updated_at_%i before update on public.%i" in sql
    assert "execute function public.set_updated_at()" in sql


def test_restore_preserves_production_agent_registry_seed_contract() -> None:
    sql = RESTORE.read_text(encoding="utf-8").lower()

    assert "insert into public.agent_registry" in sql
    assert "on conflict (agent_name) do nothing" in sql
    for agent_name in ("hermes", "tars", "ion", "sapphire", "guardian"):
        assert f"'{agent_name}'" in sql
