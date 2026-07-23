begin;

do $$
declare
  target_table text;
  policy_name text;
begin
  foreach target_table in array array['hermes_interrupts','hermes_goals','hermes_tasks','hermes_events','hermes_checkpoints']
  loop
    policy_name := 'admins select ' || target_table;
    execute format('drop policy if exists %I on public.%I', policy_name, target_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((((select auth.jwt()) -> ''app_metadata'' ->> ''role'') = ''admin''))',
      policy_name,
      target_table
    );
  end loop;
end
$$;

drop policy if exists "Users read own plan" on public.user_plans;
create policy "Users read own plan" on public.user_plans
for select to authenticated
using (
  (select auth.uid()) = user_id
  or (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
);

commit;
