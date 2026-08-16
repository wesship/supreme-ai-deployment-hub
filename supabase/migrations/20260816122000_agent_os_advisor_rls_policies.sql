-- Close current Supabase Security Advisor RLS-without-policy findings for
-- backend-only Agent OS control-plane tables without granting browser access.
begin;

revoke all privileges on table
  public.agent_os_approvals,
  public.agent_os_workspace_policies
from anon, authenticated;

drop policy if exists "agent_os_approvals direct clients denied" on public.agent_os_approvals;
create policy "agent_os_approvals direct clients denied"
on public.agent_os_approvals
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "agent_os_workspace_policies direct clients denied" on public.agent_os_workspace_policies;
create policy "agent_os_workspace_policies direct clients denied"
on public.agent_os_workspace_policies
for all
to anon, authenticated
using (false)
with check (false);

notify pgrst, 'reload schema';
commit;
