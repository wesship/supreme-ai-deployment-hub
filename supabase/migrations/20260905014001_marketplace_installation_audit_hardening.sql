create table if not exists public.marketplace_installation_events (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid references public.deployed_agents(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.marketplace_installation_events enable row level security;

drop policy if exists "Users can view own marketplace installation events" on public.marketplace_installation_events;
drop policy if exists marketplace_installation_events_select_own on public.marketplace_installation_events;
create policy marketplace_installation_events_select_own
  on public.marketplace_installation_events
  for select
  to authenticated
  using ((select auth.uid()) = actor_id);

revoke all on table public.marketplace_installation_events from anon, authenticated;
grant select on table public.marketplace_installation_events to authenticated;
grant select, insert on table public.marketplace_installation_events to service_role;

create schema if not exists private;
create or replace function private.prevent_marketplace_installation_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'marketplace installation events are append-only';
end;
$$;
revoke all on function private.prevent_marketplace_installation_event_mutation() from public;

drop trigger if exists marketplace_installation_events_immutable_update on public.marketplace_installation_events;
create trigger marketplace_installation_events_immutable_update
before update on public.marketplace_installation_events
for each row execute function private.prevent_marketplace_installation_event_mutation();

drop trigger if exists marketplace_installation_events_immutable_delete on public.marketplace_installation_events;
create trigger marketplace_installation_events_immutable_delete
before delete on public.marketplace_installation_events
for each row execute function private.prevent_marketplace_installation_event_mutation();