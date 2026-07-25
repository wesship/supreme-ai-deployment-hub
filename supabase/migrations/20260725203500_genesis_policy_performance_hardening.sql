-- Move privileged project-access evaluation behind a non-exposed schema, optimize
-- direct auth policies, remove duplicate permissive policies, and cover foreign keys.

create schema if not exists genesis_private;
revoke all on schema genesis_private from public;
revoke all on schema genesis_private from anon;
grant usage on schema genesis_private to authenticated;
grant usage on schema genesis_private to service_role;

create or replace function genesis_private.has_project_access(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.genesis_projects p
    where p.id = p_project_id
      and (select auth.uid()) is not null
      and (
        p.owner_id = (select auth.uid())
        or exists (
          select 1
          from public.genesis_project_members m
          where m.project_id = p.id
            and m.user_id = (select auth.uid())
        )
      )
  );
$$;

revoke all on function genesis_private.has_project_access(uuid) from public;
revoke all on function genesis_private.has_project_access(uuid) from anon;
grant execute on function genesis_private.has_project_access(uuid) to authenticated;
grant execute on function genesis_private.has_project_access(uuid) to service_role;

create or replace function public.genesis_has_project_access(
  p_project_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security invoker
set search_path = public, genesis_private
as $$
  select genesis_private.has_project_access(p_project_id);
$$;

revoke all on function public.genesis_has_project_access(uuid, uuid) from public;
revoke all on function public.genesis_has_project_access(uuid, uuid) from anon;
grant execute on function public.genesis_has_project_access(uuid, uuid) to authenticated;
grant execute on function public.genesis_has_project_access(uuid, uuid) to service_role;

comment on function public.genesis_has_project_access(uuid, uuid) is
  'RLS-safe wrapper. Caller-supplied user IDs are ignored; access is always evaluated as auth.uid().';

drop policy if exists genesis_projects_insert on public.genesis_projects;
create policy genesis_projects_insert on public.genesis_projects
for insert with check (owner_id = (select auth.uid()));

drop policy if exists genesis_projects_update on public.genesis_projects;
create policy genesis_projects_update on public.genesis_projects
for update using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists genesis_projects_delete on public.genesis_projects;
create policy genesis_projects_delete on public.genesis_projects
for delete using (owner_id = (select auth.uid()));

drop policy if exists genesis_members_owner_manage on public.genesis_project_members;
create policy genesis_members_owner_insert on public.genesis_project_members
for insert with check (
  exists (
    select 1 from public.genesis_projects p
    where p.id = genesis_project_members.project_id
      and p.owner_id = (select auth.uid())
  )
);
create policy genesis_members_owner_update on public.genesis_project_members
for update using (
  exists (
    select 1 from public.genesis_projects p
    where p.id = genesis_project_members.project_id
      and p.owner_id = (select auth.uid())
  )
) with check (
  exists (
    select 1 from public.genesis_projects p
    where p.id = genesis_project_members.project_id
      and p.owner_id = (select auth.uid())
  )
);
create policy genesis_members_owner_delete on public.genesis_project_members
for delete using (
  exists (
    select 1 from public.genesis_projects p
    where p.id = genesis_project_members.project_id
      and p.owner_id = (select auth.uid())
  )
);

drop policy if exists genesis_canon_owner_insert on public.genesis_canon_entries;
create policy genesis_canon_owner_insert on public.genesis_canon_entries
for insert with check (
  exists (
    select 1 from public.genesis_projects p
    where p.id = genesis_canon_entries.project_id
      and p.owner_id = (select auth.uid())
  )
);
drop policy if exists genesis_canon_owner_update on public.genesis_canon_entries;
create policy genesis_canon_owner_update on public.genesis_canon_entries
for update using (
  exists (
    select 1 from public.genesis_projects p
    where p.id = genesis_canon_entries.project_id
      and p.owner_id = (select auth.uid())
  )
) with check (
  exists (
    select 1 from public.genesis_projects p
    where p.id = genesis_canon_entries.project_id
      and p.owner_id = (select auth.uid())
  )
);
drop policy if exists genesis_canon_owner_delete on public.genesis_canon_entries;
create policy genesis_canon_owner_delete on public.genesis_canon_entries
for delete using (
  exists (
    select 1 from public.genesis_projects p
    where p.id = genesis_canon_entries.project_id
      and p.owner_id = (select auth.uid())
  )
  and locked = false
);

drop policy if exists genesis_idempotency_owner_access on public.genesis_idempotency_records;
create policy genesis_idempotency_owner_access on public.genesis_idempotency_records
for all using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy genesis_event_outbox_deny_authenticated
on public.genesis_event_outbox
for select to authenticated
using (false);

create index if not exists genesis_agents_project_id_idx on public.genesis_agents(project_id);
create index if not exists genesis_approvals_requested_by_user_idx on public.genesis_approvals(requested_by_user_id);
create index if not exists genesis_approvals_requested_by_agent_idx on public.genesis_approvals(requested_by_agent_id);
create index if not exists genesis_approvals_decided_by_user_idx on public.genesis_approvals(decided_by_user_id);
create index if not exists genesis_asset_versions_parent_idx on public.genesis_asset_versions(parent_version_id);
create index if not exists genesis_asset_versions_created_by_user_idx on public.genesis_asset_versions(created_by_user_id);
create index if not exists genesis_assets_current_version_idx on public.genesis_assets(current_version_id);
create index if not exists genesis_assets_created_by_user_idx on public.genesis_assets(created_by_user_id);
create index if not exists genesis_canon_superseded_by_idx on public.genesis_canon_entries(superseded_by);
create index if not exists genesis_canon_created_by_idx on public.genesis_canon_entries(created_by);
create index if not exists genesis_canon_approved_by_idx on public.genesis_canon_entries(approved_by);
create index if not exists genesis_evaluation_created_by_user_idx on public.genesis_evaluation_runs(created_by_user_id);
create index if not exists genesis_evaluation_created_by_agent_idx on public.genesis_evaluation_runs(created_by_agent_id);
create index if not exists genesis_event_outbox_project_idx on public.genesis_event_outbox(project_id);
create index if not exists genesis_executions_agent_idx on public.genesis_executions(agent_id);
create index if not exists genesis_findings_evaluation_idx on public.genesis_findings(evaluation_run_id);
create index if not exists genesis_goals_project_idx on public.genesis_goals(project_id);
create index if not exists genesis_goals_initiated_by_user_idx on public.genesis_goals(initiated_by_user_id);
create index if not exists genesis_goals_initiated_by_agent_idx on public.genesis_goals(initiated_by_agent_id);
create index if not exists genesis_project_members_user_idx on public.genesis_project_members(user_id);
create index if not exists genesis_provider_jobs_render_request_idx on public.genesis_provider_jobs(render_request_id);
create index if not exists genesis_provider_outputs_asset_version_idx on public.genesis_provider_outputs(asset_version_id);
create index if not exists genesis_relationships_project_idx on public.genesis_relationships(project_id);
create index if not exists genesis_render_asset_idx on public.genesis_render_requests(asset_id);
create index if not exists genesis_render_created_by_user_idx on public.genesis_render_requests(created_by_user_id);
create index if not exists genesis_render_created_by_agent_idx on public.genesis_render_requests(created_by_agent_id);
create index if not exists genesis_reviews_project_idx on public.genesis_reviews(project_id);
create index if not exists genesis_reviews_asset_idx on public.genesis_reviews(asset_id);
create index if not exists genesis_reviews_task_idx on public.genesis_reviews(task_id);
create index if not exists genesis_reviews_reviewer_user_idx on public.genesis_reviews(reviewer_user_id);
create index if not exists genesis_reviews_reviewer_agent_idx on public.genesis_reviews(reviewer_agent_id);
create index if not exists genesis_tasks_goal_idx on public.genesis_tasks(goal_id);
create index if not exists genesis_tasks_parent_idx on public.genesis_tasks(parent_task_id);
create index if not exists genesis_tasks_assigned_user_idx on public.genesis_tasks(assigned_user_id);
create index if not exists genesis_tasks_assigned_agent_idx on public.genesis_tasks(assigned_agent_id);
create index if not exists genesis_workflow_runs_definition_idx on public.genesis_workflow_runs(workflow_definition_id);
create index if not exists genesis_workflow_runs_initiated_by_user_idx on public.genesis_workflow_runs(initiated_by_user_id);
create index if not exists genesis_workflow_runs_initiated_by_agent_idx on public.genesis_workflow_runs(initiated_by_agent_id);
