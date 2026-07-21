-- D3VONN.IO Supabase RLS hardening — Phase 1
-- Staging-first migration. Do not promote until backend/service-role and tenant-isolation tests pass.

begin;

-- ---------------------------------------------------------------------------
-- 1. Restore owner/admin isolation on core Hermes tables.
-- Production drift introduced public allow_all policies; the canonical schema
-- defines user_id-scoped access and service_role bypasses RLS automatically.
-- ---------------------------------------------------------------------------

drop policy if exists allow_all on public.hermes_goals;
drop policy if exists allow_all on public.hermes_tasks;
drop policy if exists allow_all on public.hermes_events;
drop policy if exists allow_all on public.hermes_checkpoints;
drop policy if exists allow_all on public.hermes_interrupts;

-- Remove stale variants before recreating deterministic policies.
drop policy if exists "owners select hermes_goals" on public.hermes_goals;
drop policy if exists "owners insert hermes_goals" on public.hermes_goals;
drop policy if exists "owners update hermes_goals" on public.hermes_goals;
drop policy if exists "owners delete hermes_goals" on public.hermes_goals;
create policy "owners select hermes_goals" on public.hermes_goals
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));
create policy "owners insert hermes_goals" on public.hermes_goals
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "owners update hermes_goals" on public.hermes_goals
  for update to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())))
  with check ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));
create policy "owners delete hermes_goals" on public.hermes_goals
  for delete to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));

drop policy if exists "owners select hermes_tasks" on public.hermes_tasks;
drop policy if exists "owners insert hermes_tasks" on public.hermes_tasks;
drop policy if exists "owners update hermes_tasks" on public.hermes_tasks;
drop policy if exists "owners delete hermes_tasks" on public.hermes_tasks;
create policy "owners select hermes_tasks" on public.hermes_tasks
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));
create policy "owners insert hermes_tasks" on public.hermes_tasks
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "owners update hermes_tasks" on public.hermes_tasks
  for update to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())))
  with check ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));
create policy "owners delete hermes_tasks" on public.hermes_tasks
  for delete to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));

drop policy if exists "owners select hermes_interrupts" on public.hermes_interrupts;
drop policy if exists "owners insert hermes_interrupts" on public.hermes_interrupts;
drop policy if exists "owners update hermes_interrupts" on public.hermes_interrupts;
drop policy if exists "owners delete hermes_interrupts" on public.hermes_interrupts;
create policy "owners select hermes_interrupts" on public.hermes_interrupts
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));
create policy "owners insert hermes_interrupts" on public.hermes_interrupts
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "owners update hermes_interrupts" on public.hermes_interrupts
  for update to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())))
  with check ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));
create policy "owners delete hermes_interrupts" on public.hermes_interrupts
  for delete to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));

drop policy if exists "owners select hermes_checkpoints" on public.hermes_checkpoints;
drop policy if exists "owners insert hermes_checkpoints" on public.hermes_checkpoints;
drop policy if exists "owners update hermes_checkpoints" on public.hermes_checkpoints;
drop policy if exists "owners delete hermes_checkpoints" on public.hermes_checkpoints;
create policy "owners select hermes_checkpoints" on public.hermes_checkpoints
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));
create policy "owners insert hermes_checkpoints" on public.hermes_checkpoints
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "owners update hermes_checkpoints" on public.hermes_checkpoints
  for update to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())))
  with check ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));
create policy "owners delete hermes_checkpoints" on public.hermes_checkpoints
  for delete to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));

drop policy if exists "owners select hermes_events" on public.hermes_events;
drop policy if exists "owners insert hermes_events" on public.hermes_events;
create policy "owners select hermes_events" on public.hermes_events
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));
create policy "owners insert hermes_events" on public.hermes_events
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 2. Remove public service-write bypasses.
-- Service-role requests bypass RLS and retain table privileges; browser clients
-- must not be able to write arbitrary observability or subscription records.
-- ---------------------------------------------------------------------------

drop policy if exists "Service insert agent_activity_logs" on public.agent_activity_logs;
drop policy if exists "Service insert ai_request_logs" on public.ai_request_logs;
drop policy if exists "Service insert error_logs" on public.error_logs;
drop policy if exists "Service insert tool_call_logs" on public.tool_call_logs;
drop policy if exists "Service upsert user_plans" on public.user_plans;

revoke insert on public.agent_activity_logs from anon, authenticated;
revoke insert on public.ai_request_logs from anon, authenticated;
revoke insert on public.error_logs from anon, authenticated;
revoke insert on public.tool_call_logs from anon, authenticated;
revoke insert, update, delete on public.user_plans from anon, authenticated;

grant all on public.agent_activity_logs to service_role;
grant all on public.ai_request_logs to service_role;
grant all on public.error_logs to service_role;
grant all on public.tool_call_logs to service_role;
grant all on public.user_plans to service_role;

-- Preserve authenticated self-read for user plans, with init-plan-safe auth calls.
drop policy if exists "Users read own plan" on public.user_plans;
create policy "Users read own plan" on public.user_plans
  for select to authenticated
  using ((select auth.uid()) = user_id or (select auth.jwt() ->> 'role') = 'admin');

-- ---------------------------------------------------------------------------
-- 3. Pin trigger function search paths.
-- ---------------------------------------------------------------------------

alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.hermes_set_updated_at() set search_path = public, pg_temp;

commit;
