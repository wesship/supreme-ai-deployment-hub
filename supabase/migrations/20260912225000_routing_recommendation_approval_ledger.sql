create table if not exists public.ai_film_routing_recommendation_approvals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  project_id uuid,
  recommendation_key text not null,
  provider text not null,
  style_id text,
  recommendation_action text not null check (recommendation_action in ('increase_preference','decrease_preference','hold')),
  proposed_adjustment integer not null check (proposed_adjustment between -5 and 5),
  confidence text not null check (confidence in ('low','medium','high')),
  decision text not null check (decision in ('approved','rejected')),
  rationale text not null check (char_length(btrim(rationale)) between 3 and 2000),
  evidence jsonb not null,
  evidence_hash text not null check (evidence_hash ~ '^[0-9a-f]{64}$'),
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint routing_recommendation_approval_unique_evidence unique (owner_id, recommendation_key, evidence_hash)
);

create index if not exists idx_ai_film_routing_recommendation_approvals_owner_decided
  on public.ai_film_routing_recommendation_approvals(owner_id, decided_at desc);
create index if not exists idx_ai_film_routing_recommendation_approvals_project
  on public.ai_film_routing_recommendation_approvals(project_id, decided_at desc)
  where project_id is not null;

alter table public.ai_film_routing_recommendation_approvals enable row level security;

revoke all on table public.ai_film_routing_recommendation_approvals from anon, authenticated;
grant select, insert on table public.ai_film_routing_recommendation_approvals to authenticated;
grant select, insert, update, delete on table public.ai_film_routing_recommendation_approvals to service_role;

create policy "owners read routing recommendation approvals"
on public.ai_film_routing_recommendation_approvals
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "owners create routing recommendation approvals"
on public.ai_film_routing_recommendation_approvals
for insert
to authenticated
with check (
  (select auth.uid()) = owner_id
  and (select auth.uid()) = reviewer_id
);
