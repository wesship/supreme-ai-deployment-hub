from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "20260818014000_primetime_reference_table_rls_hardening.sql"


def test_reference_table_rls_hardening_exists_and_targets_exposed_tables() -> None:
    assert MIGRATION.exists()
    source = MIGRATION.read_text(encoding="utf-8")

    for table in ["primetime_roles", "primetime_compliance_rules"]:
        assert f"alter table public.{table} enable row level security" in source
        assert f"revoke all privileges on table public.{table} from public, anon, authenticated" in source
        assert f"grant all privileges on table public.{table} to service_role" in source
        assert f'create policy "Deny direct browser access"\n  on public.{table}' in source


def test_reference_table_rls_hardening_has_no_permissive_browser_access() -> None:
    source = MIGRATION.read_text(encoding="utf-8")

    assert "to anon, authenticated" in source
    assert "using (false)" in source
    assert "with check (false)" in source
    assert "to public" not in source
    assert "using (true)" not in source
    assert "with check (true)" not in source
