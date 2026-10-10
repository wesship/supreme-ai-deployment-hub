from pathlib import Path


MIGRATION = Path("supabase/migrations/20260811035000_private_workspace_membership_helper.sql")


def test_membership_helper_moves_to_private_schema():
    sql = MIGRATION.read_text()
    assert "function private.is_active_workspace_member" in sql
    assert "grant execute on function private.is_active_workspace_member(uuid) to authenticated, service_role" in sql
    assert "to_regprocedure('public.is_active_workspace_member(uuid)')" in sql
    assert "revoke execute on function public.is_active_workspace_member(uuid) from authenticated" in sql


def test_workspace_member_policies_are_repointed_only_when_present():
    sql = MIGRATION.read_text()
    policies = [
        "appointment_attendees_workspace_members",
        "appointments_workspace_members",
        "availability_rules_workspace_members",
        "calendar_sync_events_workspace_members",
        "no_show_events_workspace_members",
        "reminders_workspace_members",
    ]
    for policy in policies:
        assert policy in sql
    assert "from pg_policies" in sql
    assert "to_regclass(format('public.%I', policy_spec.table_name))" in sql
    assert "private.is_active_workspace_member(workspace_id)" in sql
