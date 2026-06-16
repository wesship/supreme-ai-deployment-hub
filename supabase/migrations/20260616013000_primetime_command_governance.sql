begin;

create table if not exists public.command_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  requested_by uuid not null,
  idempotency_key text not null,
  command_hash text not null,
  raw_command text not null,
  registry_version text not null,
  parsed jsonb not null,
  routing jsonb not null,
  status text not null check (status in ('blocked','draft-ready','review-required','approved','rejected','executed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create table if not exists public.command_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  command_plan_id uuid not null references public.command_plans(id) on delete restrict,
  reviewer_id uuid not null,
  reviewer_role text not null check (reviewer_role in ('manager','compliance','licensed_representative','admin')),
  review_level smallint not null check (review_level between 0 and 3),
  decision text not null check (decision in ('approved','rejected')),
  reason text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create table if not exists public.command_execution_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null,
  command_plan_id uuid not null references public.command_plans(id) on delete restrict,
  actor_id uuid,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create index if not exists command_plans_workspace_created_idx on public.command_plans(workspace_id, created_at desc);
create index if not exists command_reviews_plan_created_idx on public.command_reviews(command_plan_id, created_at desc);
create index if not exists command_events_plan_created_idx on public.command_execution_events(command_plan_id, created_at desc);

alter table public.command_plans enable row level security;
alter table public.command_reviews enable row level security;
alter table public.command_execution_events enable row level security;

create policy command_plans_workspace_select on public.command_plans
for select using (requested_by = auth.uid());
create policy command_plans_workspace_insert on public.command_plans
for insert with check (requested_by = auth.uid());
create policy command_plans_workspace_update on public.command_plans
for update using (requested_by = auth.uid()) with check (requested_by = auth.uid());

create policy command_reviews_visible_to_plan_owner on public.command_reviews
for select using (
  exists (
    select 1 from public.command_plans p
    where p.id = command_reviews.command_plan_id and p.requested_by = auth.uid()
  )
  or reviewer_id = auth.uid()
);
create policy command_reviews_reviewer_insert on public.command_reviews
for insert with check (reviewer_id = auth.uid());

create policy command_events_visible_to_plan_owner on public.command_execution_events
for select using (
  exists (
    select 1 from public.command_plans p
    where p.id = command_execution_events.command_plan_id and p.requested_by = auth.uid()
  )
  or actor_id = auth.uid()
);
create policy command_events_actor_insert on public.command_execution_events
for insert with check (actor_id = auth.uid());

create or replace function public.prevent_command_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'command audit records are immutable';
end;
$$;

create trigger command_reviews_immutable
before update or delete on public.command_reviews
for each row execute function public.prevent_command_audit_mutation();

create trigger command_events_immutable
before update or delete on public.command_execution_events
for each row execute function public.prevent_command_audit_mutation();

commit;
