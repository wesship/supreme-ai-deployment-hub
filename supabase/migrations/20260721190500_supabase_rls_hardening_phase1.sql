-- D3VONN.IO Supabase RLS hardening — Phase 1
-- Validated on isolated Supabase branch rls-hardening-phase1.
-- Core Hermes tables do not contain user_id and are read directly only by the
-- administrative OCC. Browser access is therefore admin read-only; trusted
-- backend and Edge Function service_role paths retain full access.

begin;

-- ---------------------------------------------------------------------------
-- 1. Replace public Hermes access with admin-only browser reads.
-- ---------------------------------------------------------------------------

do $$
declare
  tbl text;
  pol record;
begin
  foreach tbl in array array[
    'hermes_goals',
    'hermes_tasks',
    'hermes_events',
    'hermes_checkpoints',
    'hermes_interrupts'
  ] loop
    if to_regclass(format('public.%I', tbl)) is null then
      continue;
    end if;

    for pol in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = tbl
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
    end loop;

    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all on public.%I from anon, authenticated', tbl);
    execute format('grant select on public.%I to authenticated', tbl);
    execute format('grant all on public.%I to service_role', tbl);
    execute format(
      'create policy %I on public.%I for select to authenticated using (((select auth.jwt() ->> ''role'')) = ''admin'')',
      'admins select ' || tbl,
      tbl
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Remove public service-write bypasses when those tables exist.
-- ---------------------------------------------------------------------------

do $$
declare
  tbl text;
  policy_name text;
begin
  foreach tbl in array array[
    'agent_activity_logs',
    'ai_request_logs',
    'error_logs',
    'tool_call_logs'
  ] loop
    if to_regclass(format('public.%I', tbl)) is null then
      continue;
    end if;

    policy_name := case tbl
      when 'agent_activity_logs' then 'Service insert agent_activity_logs'
      when 'ai_request_logs' then 'Service insert ai_request_logs'
      when 'error_logs' then 'Service insert error_logs'
      when 'tool_call_logs' then 'Service insert tool_call_logs'
    end;

    execute format('drop policy if exists %I on public.%I', policy_name, tbl);
    execute format('revoke insert on public.%I from anon, authenticated', tbl);
    execute format('grant all on public.%I to service_role', tbl);
  end loop;

  if to_regclass('public.user_plans') is not null then
    execute 'drop policy if exists "Service upsert user_plans" on public.user_plans';
    execute 'revoke insert, update, delete on public.user_plans from anon, authenticated';
    execute 'grant all on public.user_plans to service_role';

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_plans'
        and column_name = 'user_id'
    ) then
      execute 'drop policy if exists "Users read own plan" on public.user_plans';
      execute 'create policy "Users read own plan" on public.user_plans for select to authenticated using (((select auth.uid()) = user_id) or ((select auth.jwt() ->> ''role'') = ''admin''))';
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Pin trigger-function search paths only when the functions exist.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    execute 'alter function public.set_updated_at() set search_path = public, pg_temp';
  end if;

  if to_regprocedure('public.hermes_set_updated_at()') is not null then
    execute 'alter function public.hermes_set_updated_at() set search_path = public, pg_temp';
  end if;
end $$;

commit;
