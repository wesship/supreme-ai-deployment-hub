-- Allow authenticated administrators to read the global operational data
-- used by the Executive Command Center while preserving owner-scoped access.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'deployed_agents'
      and policyname = 'Admins can view all deployed agents'
  ) then
    create policy "Admins can view all deployed agents"
      on public.deployed_agents
      for select
      to authenticated
      using ((((select auth.jwt()) -> 'app_metadata') ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workflows'
      and policyname = 'Admins can view all workflows'
  ) then
    create policy "Admins can view all workflows"
      on public.workflows
      for select
      to authenticated
      using ((((select auth.jwt()) -> 'app_metadata') ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workflow_runs'
      and policyname = 'Admins can view all workflow runs'
  ) then
    create policy "Admins can view all workflow runs"
      on public.workflow_runs
      for select
      to authenticated
      using ((((select auth.jwt()) -> 'app_metadata') ->> 'role') = 'admin');
  end if;
end
$$;

notify pgrst, 'reload schema';
