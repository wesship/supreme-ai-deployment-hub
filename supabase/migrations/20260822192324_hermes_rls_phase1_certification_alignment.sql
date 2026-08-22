-- Align the Hermes security boundary with the production Phase-1 model.
-- Raw Hermes runtime tables are infrastructure data: browser access is admin-read-only;
-- trusted backend/Edge paths retain service_role access.
do $$
declare
  t text;
  policy_name text;
begin
  foreach t in array array[
    'hermes_goals',
    'hermes_tasks',
    'hermes_events',
    'hermes_checkpoints',
    'hermes_interrupts'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on table public.%I from anon, authenticated', t);
      execute format('grant select on table public.%I to authenticated', t);
      execute format('grant all on table public.%I to service_role', t);

      -- Remove every existing direct-client policy so permissive legacy/ownership
      -- policies cannot survive the Phase-1 admin-only boundary.
      for policy_name in
        select p.policyname
        from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = t
      loop
        execute format('drop policy if exists %I on public.%I', policy_name, t);
      end loop;

      execute format(
        'create policy %I on public.%I for select to authenticated using ((select auth.jwt()->''app_metadata''->>''role'') = ''admin'')',
        'admins select ' || t,
        t
      );
    end if;
  end loop;
end $$;
