-- Make the public readiness probe independent of caller table privileges.
-- The function remains SECURITY INVOKER and exposes only fixed schema-presence booleans.

begin;

create or replace function public.dashboard_schema_readiness()
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with readiness as (
    select
      to_regclass('public.workflows') is not null as workflows_ready,
      to_regclass('public.workflow_runs') is not null as workflow_runs_ready,
      exists (
        select 1
        from pg_catalog.pg_attribute attribute
        where attribute.attrelid = to_regclass('public.agent_activity_logs')
          and attribute.attname = 'agent_name'
          and attribute.attnum > 0
          and not attribute.attisdropped
      ) as agent_name_ready
  )
  select jsonb_build_object(
    'ready',
      workflows_ready
      and workflow_runs_ready
      and agent_name_ready,
    'missing',
      to_jsonb(array_remove(array[
        case when not workflows_ready then 'public.workflows' end,
        case when not workflow_runs_ready then 'public.workflow_runs' end,
        case when not agent_name_ready then 'public.agent_activity_logs.agent_name' end
      ]::text[], null))
  )
  from readiness;
$$;

revoke all on function public.dashboard_schema_readiness() from public;
grant execute on function public.dashboard_schema_readiness()
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;