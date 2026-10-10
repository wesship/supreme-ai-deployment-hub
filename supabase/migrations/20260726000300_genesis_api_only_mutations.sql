-- Genesis governed records are observable through RLS but mutated only through the
-- authenticated FastAPI service. This prevents browser clients from bypassing task
-- transitions, immutable asset versions, workflow state, or agent governance.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'genesis_entities',
    'genesis_relationships',
    'genesis_assets',
    'genesis_agents',
    'genesis_goals',
    'genesis_tasks',
    'genesis_workflow_definitions',
    'genesis_workflow_runs',
    'genesis_reviews'
  ] loop
    execute format('drop policy if exists %I_project_access on public.%I', table_name, table_name);
    execute format(
      'create policy %I_select on public.%I for select using (public.genesis_has_project_access(project_id))',
      table_name,
      table_name
    );
  end loop;
end;
$$;

drop policy if exists genesis_asset_versions_access on public.genesis_asset_versions;
create policy genesis_asset_versions_select
on public.genesis_asset_versions
for select
using (
  exists (
    select 1 from public.genesis_assets a
    where a.id = asset_id and public.genesis_has_project_access(a.project_id)
  )
);

-- Project metadata remains owner-writable so ownership and archival can be managed
-- through Supabase if the API is unavailable. All production sub-resources are API-only.
comment on table public.genesis_tasks is
  'Task transitions are API-only and validated by the Genesis state machine.';
comment on table public.genesis_asset_versions is
  'Immutable production versions are created by the trusted asset API and workers.';
comment on table public.genesis_workflow_runs is
  'Workflow state is durable and mutated only by Hermes/FastAPI service-role operations.';
