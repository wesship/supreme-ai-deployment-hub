from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RESTORE = ROOT / "supabase" / "migrations" / "20260725225100_restore_hermes_runtime_ledger.sql"
TASK_ENGINE = ROOT / "backend" / "hermes" / "task_engine.py"
CONTRACTS = ROOT / "backend" / "hermes" / "contracts.py"


def _sql() -> str:
    return RESTORE.read_text(encoding="utf-8").lower()


def test_restore_migration_is_timestamped_and_present() -> None:
    assert RESTORE.exists()
    assert RESTORE.name[:14].isdigit()


def test_restore_recreates_the_missing_hermes_runtime_tables() -> None:
    sql = _sql()

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
        assert f"grant all on public.{table_name} to service_role" in sql
        assert f"grant select on public.{table_name} to authenticated" in sql


def test_restore_reconciles_every_task_engine_write_column() -> None:
    sql = _sql()
    task_engine = TASK_ENGINE.read_text(encoding="utf-8")

    task_columns = (
        "agent_name",
        "assigned_to",
        "priority",
        "retry_count",
        "locked_at",
        "task_type",
        "source",
        "description",
        "input_data",
        "output_data",
        "scheduled_at",
        "deadline_at",
        "correlation_id",
        "assigned_at",
    )
    for column_name in task_columns:
        assert f"alter table public.hermes_tasks add column if not exists {column_name}" in sql

    for runtime_field in (
        '"task_type"',
        '"source"',
        '"description"',
        '"input_data"',
        '"scheduled_at"',
        '"deadline_at"',
        '"correlation_id"',
        '"started_at"',
        '"assigned_at"',
        '"completed_at"',
        '"output_data"',
        '"error_message"',
    ):
        assert runtime_field in task_engine

    assert "alter table public.hermes_tasks alter column goal_id drop not null" in sql
    assert "alter table public.hermes_tasks alter column kind set default 'task'" in sql


def test_restore_aligns_task_status_constraint_with_contract_v1() -> None:
    sql = _sql()
    contracts = CONTRACTS.read_text(encoding="utf-8")

    for status in (
        "PENDING",
        "LOCKED",
        "RUNNING",
        "COMPLETED",
        "FAILED",
        "RETRY",
        "MANUAL_REVIEW",
        "ESCALATED",
        "PAUSED",
        "CANCELLED",
    ):
        assert f'{status} = "{status}"' in contracts
        assert f"'{status.lower()}'" in sql

    assert "drop constraint if exists hermes_tasks_status_check" in sql
    assert "alter column status set default 'pending'" in sql


def test_restore_matches_run_lifecycle_writes() -> None:
    sql = _sql()
    task_engine = TASK_ENGINE.read_text(encoding="utf-8")

    for column_name in (
        "run_number",
        "status",
        "finished_at",
        "output_snapshot",
        "error_detail",
        "tokens_used",
        "cost_usd",
        "duration_ms",
    ):
        assert f"alter table public.hermes_runs add column if not exists {column_name}" in sql
        assert f'"{column_name}"' in task_engine

    assert "hermes_runs_status_check" in sql
    assert "'pending', 'running', 'completed', 'failed', 'cancelled'" in sql


def test_restore_matches_structured_log_event_writes() -> None:
    sql = _sql()
    task_engine = TASK_ENGINE.read_text(encoding="utf-8")

    for column_name in ("event", "agent_name", "correlation_id"):
        assert f"alter table public.hermes_logs add column if not exists {column_name}" in sql
        assert f'"{column_name}"' in task_engine

    assert "alter table public.hermes_logs alter column message drop not null" in sql
    assert "alter table public.hermes_logs alter column event set not null" in sql


def test_restore_recreates_update_triggers_safely() -> None:
    sql = _sql()

    assert "create or replace function public.set_updated_at()" in sql
    assert "set search_path = public, pg_temp" in sql
    assert "foreach table_name in array array['hermes_memory', 'hermes_followups', 'agent_registry']" in sql
    assert "drop trigger if exists %i on public.%i" in sql
    assert "create trigger %i before update on public.%i" in sql
    assert "execute function public.set_updated_at()" in sql


def test_restore_preserves_production_agent_registry_seed_contract() -> None:
    sql = _sql()

    assert "insert into public.agent_registry" in sql
    assert "on conflict (agent_name) do nothing" in sql
    for agent_name in ("hermes", "tars", "ion", "sapphire", "guardian"):
        assert f"'{agent_name}'" in sql


def test_restore_is_additive_and_transactional() -> None:
    sql = _sql()

    assert sql.strip().startswith("-- restore the hermes runtime schema")
    assert "\nbegin;" in sql
    assert sql.strip().endswith("commit;")
    assert "drop table" not in sql
