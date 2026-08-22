-- Align the staging Hermes security boundary with the production Phase-1 model.
-- Raw Hermes runtime tables are infrastructure data: browser access is admin-read-only;
-- trusted backend/Edge paths retain service_role access.
do $$
declare
  t text;
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
      execute format('drop policy if exists "Authenticated read %I" on public.%I', t, t);
      execute format('drop policy if exists "admins select %I" on public.%I', t, t);
      execute format('drop policy if exists "allow_all" on public.%I', t);
      execute format(
        'create policy "admins select %I" on public.%I for select to authenticated using ((select auth.jwt()->''app_metadata''->>''role'') = ''admin'')',
        t, t
      );
    end if;
  end loop;
end $$;
