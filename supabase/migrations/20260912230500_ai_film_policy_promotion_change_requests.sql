create table if not exists public.ai_film_policy_promotion_change_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  project_id uuid null,
  approval_id uuid not null references public.ai_film_routing_recommendation_approvals(id) on delete restrict,
  recommendation_key text not null,
  evidence_hash text not null,
  provider text not null,
  style_id text null,
  recommendation_action text not null check (recommendation_action in ('increase_preference','decrease_preference','hold')),
  proposed_adjustment integer not null check (proposed_adjustment between -5 and 5),
  proposed_runtime_delta jsonb not null,
  rollback_plan text not null check (char_length(rollback_plan) between 3 and 4000),
  required_canary_provider text null,
  required_canary_state text not null default 'not_required' check (required_canary_state in ('not_required','pass_required')),
  second_review_required boolean not null default true,
  requestor_id uuid not null default auth.uid(),
  status text not null default 'pending_second_review' check (status = 'pending_second_review'),
  created_at timestamptz not null default now(),
  constraint ai_film_policy_promotion_request_exact_approval unique (owner_id, approval_id)
);

create index if not exists ai_film_policy_promotion_change_requests_owner_created_idx
  on public.ai_film_policy_promotion_change_requests(owner_id, created_at desc);
create index if not exists ai_film_policy_promotion_change_requests_approval_idx
  on public.ai_film_policy_promotion_change_requests(approval_id);

alter table public.ai_film_policy_promotion_change_requests enable row level security;
revoke all on public.ai_film_policy_promotion_change_requests from anon;
revoke all on public.ai_film_policy_promotion_change_requests from authenticated;
grant select, insert on public.ai_film_policy_promotion_change_requests to authenticated;
grant all on public.ai_film_policy_promotion_change_requests to service_role;

create policy "owners read policy promotion change requests"
on public.ai_film_policy_promotion_change_requests
for select to authenticated
using ((select auth.uid()) = owner_id);

create policy "owners create policy promotion change requests"
on public.ai_film_policy_promotion_change_requests
for insert to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = owner_id
  and (select auth.uid()) = requestor_id
  and exists (
    select 1
    from public.ai_film_routing_recommendation_approvals a
    where a.id = approval_id
      and a.owner_id = (select auth.uid())
      and a.decision = 'approved'
      and a.recommendation_key = ai_film_policy_promotion_change_requests.recommendation_key
      and a.evidence_hash = ai_film_policy_promotion_change_requests.evidence_hash
  )
);