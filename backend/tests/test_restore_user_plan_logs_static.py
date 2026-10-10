from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RESTORE = ROOT / "supabase" / "migrations" / "20260723055000_restore_user_plan_logs.sql"
BOUNDARY = ROOT / "supabase" / "migrations" / "20260723060000_phase2_explicit_backend_boundaries.sql"


def test_restore_runs_before_backend_boundary() -> None:
    assert RESTORE.exists()
    assert BOUNDARY.exists()
    assert RESTORE.name < BOUNDARY.name


def test_restore_reproduces_production_table_shape_and_security() -> None:
    sql = RESTORE.read_text(encoding="utf-8").lower()

    assert "create table if not exists public.user_plan_logs" in sql
    assert "user_id uuid references auth.users(id) on delete set null" in sql
    assert "steps jsonb default '[]'::jsonb" in sql
    assert "metadata jsonb default '{}'::jsonb" in sql
    assert "create index if not exists idx_user_plan_logs_user_id" in sql
    assert "alter table public.user_plan_logs enable row level security" in sql
    assert (
        "revoke all privileges on table public.user_plan_logs "
        "from public, anon, authenticated"
    ) in sql
    assert "grant all privileges on table public.user_plan_logs to service_role" in sql


def test_backend_boundary_targets_restored_table() -> None:
    sql = BOUNDARY.read_text(encoding="utf-8").lower()
    assert "'user_plan_logs'" in sql
