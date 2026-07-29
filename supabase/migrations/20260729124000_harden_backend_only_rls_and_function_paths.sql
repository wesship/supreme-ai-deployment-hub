-- Resolve database security-advisor findings without exposing backend-only data.
begin;

create schema if not exists extensions;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'vector')
     and exists (select 1 from pg_extension where extname = 'vector' and extrelocatable)
     and (
       select namespace.nspname
       from pg_extension extension
       join pg_namespace namespace on namespace.oid = extension.extnamespace
       where extension.extname = 'vector'
     ) <> 'extensions'
  then
    alter extension vector set schema extensions;
  end if;
end
$$;

grant usage on schema extensions to anon, authenticated, service_role;

alter function public.set_updated_at()
  set search_path = pg_catalog, public;
revoke all on function public.set_updated_at()
  from public, anon, authenticated;

revoke all privileges on table
  public.agent_activity_logs,
  public.ai_request_logs,
  public.approval_queue,
  public.error_logs,
  public.ops_alerts,
  public.ops_approvals,
  public.ops_audit_events,
  public.ops_health_checks,
  public.ops_incidents,
  public.ops_remediations,
  public.rag_documents,
  public.tool_call_logs,
  public.user_plans
from anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'agent_activity_logs',
    'ai_request_logs',
    'approval_queue',
    'error_logs',
    'ops_alerts',
    'ops_approvals',
    'ops_audit_events',
    'ops_health_checks',
    'ops_incidents',
    'ops_remediations',
    'rag_documents',
    'tool_call_logs',
    'user_plans'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      table_name || ' direct clients denied',
      table_name
    );
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
      table_name || ' direct clients denied',
      table_name
    );
  end loop;
end
$$;

notify pgrst, 'reload schema';
commit;
