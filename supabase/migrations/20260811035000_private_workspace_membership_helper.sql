-- Keep the workspace-membership SECURITY DEFINER helper available to RLS
-- without exposing it as a public PostgREST RPC to every authenticated user.
--
-- This migration must also replay cleanly on environments where some legacy
-- PRIMETIME policies or the legacy public helper were never created. Existing
-- policies are repointed when present; absent legacy objects are not recreated.

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_active_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.primetime_workspace_memberships wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
  );
$$;

revoke all on function private.is_active_workspace_member(uuid) from public;
revoke all on function private.is_active_workspace_member(uuid) from anon;
grant execute on function private.is_active_workspace_member(uuid) to authenticated, service_role;

-- Repoint only policies that actually exist in the target environment. Some
-- clean/reconstructed databases intentionally omit legacy policy names.
do $$
declare
  policy_spec record;
begin
  for policy_spec in
    select *
    from (values
      ('appointment_attendees', 'appointment_attendees_workspace_members'),
      ('appointments', 'appointments_workspace_members'),
      ('availability_rules', 'availability_rules_workspace_members'),
      ('calendar_sync_events', 'calendar_sync_events_workspace_members'),
      ('no_show_events', 'no_show_events_workspace_members'),
      ('reminders', 'reminders_workspace_members')
    ) as v(table_name, policy_name)
  loop
    if to_regclass(format('public.%I', policy_spec.table_name)) is not null
       and exists (
         select 1
         from pg_policies p
         where p.schemaname = 'public'
           and p.tablename = policy_spec.table_name
           and p.policyname = policy_spec.policy_name
       ) then
      execute format(
        'alter policy %I on public.%I using (private.is_active_workspace_member(workspace_id)) with check (private.is_active_workspace_member(workspace_id))',
        policy_spec.policy_name,
        policy_spec.table_name
      );
    end if;
  end loop;
end
$$;

-- Preserve the legacy public helper for service-side compatibility only, when
-- it exists, while removing direct browser/API execution from ordinary users.
do $$
begin
  if to_regprocedure('public.is_active_workspace_member(uuid)') is not null then
    revoke execute on function public.is_active_workspace_member(uuid) from public;
    revoke execute on function public.is_active_workspace_member(uuid) from anon;
    revoke execute on function public.is_active_workspace_member(uuid) from authenticated;
    grant execute on function public.is_active_workspace_member(uuid) to service_role;
  end if;
end
$$;
