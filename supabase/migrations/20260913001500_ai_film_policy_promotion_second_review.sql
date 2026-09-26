create table if not exists public.ai_film_policy_promotion_reviews (
  id uuid primary key default gen_random_uuid(),
  change_request_id uuid not null references public.ai_film_policy_promotion_change_requests(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('approved','rejected')),
  rationale text not null check (char_length(btrim(rationale)) between 3 and 2000),
  canary_state text not null check (canary_state in ('passed','not_required','not_checked')),
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(change_request_id)
);

alter table public.ai_film_policy_promotion_reviews enable row level security;

revoke all on table public.ai_film_policy_promotion_reviews from anon;
revoke all on table public.ai_film_policy_promotion_reviews from authenticated;
grant select on table public.ai_film_policy_promotion_reviews to authenticated;
grant all on table public.ai_film_policy_promotion_reviews to service_role;

create index if not exists ai_film_policy_promotion_reviews_owner_idx
  on public.ai_film_policy_promotion_reviews(owner_id, reviewed_at desc);
create index if not exists ai_film_policy_promotion_reviews_reviewer_idx
  on public.ai_film_policy_promotion_reviews(reviewer_id, reviewed_at desc);
create index if not exists ai_film_policy_promotion_reviews_request_idx
  on public.ai_film_policy_promotion_reviews(change_request_id);

drop policy if exists "owners read policy promotion reviews" on public.ai_film_policy_promotion_reviews;
drop policy if exists "owners create separated policy promotion reviews" on public.ai_film_policy_promotion_reviews;
drop policy if exists "owners and reviewers read policy promotion reviews" on public.ai_film_policy_promotion_reviews;

create policy "owners and reviewers read policy promotion reviews"
  on public.ai_film_policy_promotion_reviews
  for select
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or (select auth.uid()) = reviewer_id
  );

-- Inserts are intentionally backend-only through the protected FastAPI review endpoint.
-- The endpoint authenticates the human reviewer, verifies reviewer != requestor,
-- validates the persisted canary prerequisite, and writes with the server-side
-- service role. No UPDATE or DELETE privilege is granted to authenticated clients.
