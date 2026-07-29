-- Evaluate auth.uid() once per statement and narrow vault policies to authenticated users.
begin;

alter policy "workflow owners can read" on public.workflows
  using (user_id = (select auth.uid()));
alter policy "workflow owners can insert" on public.workflows
  with check (user_id = (select auth.uid()));
alter policy "workflow owners can update" on public.workflows
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy "workflow owners can delete" on public.workflows
  using (user_id = (select auth.uid()));

alter policy "workflow run owners can read" on public.workflow_runs
  using (user_id = (select auth.uid()));
alter policy "workflow run owners can insert" on public.workflow_runs
  with check (user_id = (select auth.uid()));
alter policy "workflow run owners can update" on public.workflow_runs
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "Users can read their own roles" on public.user_roles
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "Secrets vault admins can view inventory" on public.secret_inventory
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles role_row
      where role_row.user_id = (select auth.uid())
        and role_row.role = 'admin'
    )
  );

alter policy "Secrets vault admins can insert inventory" on public.secret_inventory
  to authenticated
  with check (
    exists (
      select 1
      from public.user_roles role_row
      where role_row.user_id = (select auth.uid())
        and role_row.role = 'admin'
    )
  );

alter policy "Secrets vault admins can update inventory" on public.secret_inventory
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles role_row
      where role_row.user_id = (select auth.uid())
        and role_row.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles role_row
      where role_row.user_id = (select auth.uid())
        and role_row.role = 'admin'
    )
  );

alter policy "Secrets vault admins can delete inventory" on public.secret_inventory
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles role_row
      where role_row.user_id = (select auth.uid())
        and role_row.role = 'admin'
    )
  );

alter policy "Secrets vault admins can view audit" on public.secret_inventory_audit
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles role_row
      where role_row.user_id = (select auth.uid())
        and role_row.role = 'admin'
    )
  );

notify pgrst, 'reload schema';
commit;
