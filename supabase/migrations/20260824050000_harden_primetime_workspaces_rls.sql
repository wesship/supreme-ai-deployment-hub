begin;

-- Production hardening: workspace records are tenant-scoped. Membership is
-- evaluated by the private SECURITY DEFINER helper, whose EXECUTE is already
-- restricted to authenticated/service_role by the preceding security migration.
alter table public.primetime_workspaces enable row level security;

-- Avoid duplicate policy creation when this migration is replayed.
drop policy if exists primetime_workspaces_select_members on public.primetime_workspaces;
drop policy if exists primetime_workspaces_update_members on public.primetime_workspaces;

create policy primetime_workspaces_select_members
on public.primetime_workspaces
for select
to authenticated
using ((select private.is_active_workspace_member(id)));

create policy primetime_workspaces_update_members
on public.primetime_workspaces
for update
to authenticated
using ((select private.is_active_workspace_member(id)))
with check ((select private.is_active_workspace_member(id)));

-- Workspace creation/deletion remains a privileged server-side operation.
-- Do not grant browser/API roles direct INSERT or DELETE access here.
revoke insert, delete on public.primetime_workspaces from anon, authenticated;

grant select, update on public.primetime_workspaces to authenticated;

commit;
