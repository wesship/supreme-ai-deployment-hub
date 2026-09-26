create table if not exists public.ai_film_policy_promotion_rollouts (
  id uuid primary key default gen_random_uuid(),
  change_request_id uuid not null unique references public.ai_film_policy_promotion_change_requests(id) on delete restrict,
  review_id uuid not null unique references public.ai_film_policy_promotion_reviews(id) on delete restrict,
  owner_id uuid not null,
  executor_id uuid not null,
  environment text not null check (environment in ('staging','production')),
  authorization_token_hash text,
  pre_change_config jsonb not null,
  approved_delta jsonb not null,
  post_change_config jsonb not null,
  rollback_config jsonb not null,
  status text not null default 'validated' check (status in ('validated','applied','rolled_back','failed')),
  runtime_changed boolean not null default false,
  executed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (environment <> 'production' or authorization_token_hash is not null)
);

alter table public.ai_film_policy_promotion_rollouts enable row level security;
revoke all on table public.ai_film_policy_promotion_rollouts from anon, authenticated;
grant select on table public.ai_film_policy_promotion_rollouts to authenticated;
grant select, insert, update, delete on table public.ai_film_policy_promotion_rollouts to service_role;

create policy "promotion rollout participants can read"
on public.ai_film_policy_promotion_rollouts for select to authenticated
using ((select auth.uid()) is not null and ((select auth.uid()) = owner_id or (select auth.uid()) = executor_id));

create index if not exists ai_film_policy_promotion_rollouts_owner_idx
on public.ai_film_policy_promotion_rollouts(owner_id, created_at desc);
