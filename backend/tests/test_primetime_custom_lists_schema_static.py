from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "20260726012000_primetime_custom_lists.sql"


def test_custom_lists_schema_contains_required_tables_and_indexes():
    sql = MIGRATION.read_text().lower()

    assert "public.primetime_custom_lists" in sql
    assert "public.primetime_custom_list_members" in sql
    assert "primetime_custom_lists_active_name_uq" in sql
    assert "primetime_custom_list_members_active_uq" in sql


def test_custom_lists_schema_is_deny_by_default_for_browser_roles():
    sql = MIGRATION.read_text().lower()

    for table in ("primetime_custom_lists", "primetime_custom_list_members"):
        assert f"alter table public.{table} enable row level security" in sql
        assert f"revoke all on table public.{table} from anon, authenticated" in sql
        assert f"grant all on table public.{table} to service_role" in sql


def test_custom_lists_schema_uses_soft_archive_and_soft_member_removal():
    sql = MIGRATION.read_text().lower()

    assert "archived_at timestamptz" in sql
    assert "removed_at timestamptz" in sql
    assert "hard deletion is not part of the governed api contract" in sql
    assert "active record counts derive from rows where removed_at is null" in sql
    assert "delete from public.primetime_custom_lists" not in sql
    assert "delete from public.primetime_custom_list_members" not in sql
