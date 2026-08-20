from pathlib import Path


MIGRATION = Path("supabase/migrations/20260820194500_primetime_event_ledger.sql")


def test_event_ledger_uses_canonical_primetime_workspace():
    sql = MIGRATION.read_text()
    assert "references public.primetime_workspaces(id)" in sql
    assert "private.is_active_workspace_member(workspace_id)" in sql
    assert "public.workspaces(id)" not in sql
    assert "public.is_workspace_member(workspace_id)" not in sql


def test_event_ledger_has_no_mutation_policy():
    sql = MIGRATION.read_text()
    assert "for update" not in sql.lower()
    assert "for delete" not in sql.lower()
