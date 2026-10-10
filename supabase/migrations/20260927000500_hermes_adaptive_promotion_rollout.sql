create table if not exists public.hermes_adaptive_promotion_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  promotion_candidate_id uuid not null unique references public.hermes_adaptive_promotion_candidates(id) on delete cascade,
  reviewer_id uuid not null,
  decision text not null check (decision in ('approved','rejected')),
  rationale text not null check (char_length(btrim(rationale)) between 3 and 4000),
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.hermes_adaptive_promotion_reviews enable row level security;
revoke all on public.hermes_adaptive_promotion_reviews from anon, authenticated;
grant select on public.hermes_adaptive_promotion_reviews to authenticated;
grant all on public.hermes_adaptive_promotion_reviews to service_role;
create policy "owners read adaptive promotion reviews"
on public.hermes_adaptive_promotion_reviews for select to authenticated
using ((select auth.uid()) = user_id or (select auth.uid()) = reviewer_id);

create table if not exists public.hermes_adaptive_rollouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  promotion_candidate_id uuid not null references public.hermes_adaptive_promotion_candidates(id) on delete cascade,
  promotion_review_id uuid not null references public.hermes_adaptive_promotion_reviews(id) on delete restrict,
  executor_id uuid not null,
  environment text not null check (environment in ('staging','production')),
  authorization_token_hash text,
  pre_change_config jsonb not null default '{}'::jsonb,
  approved_delta jsonb not null default '{}'::jsonb,
  post_change_config jsonb not null default '{}'::jsonb,
  rollback_config jsonb not null default '{}'::jsonb,
  status text not null default 'validated' check (status in ('validated','applied','rolled_back','failed')),
  runtime_changed boolean not null default false,
  deployment_evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (promotion_candidate_id, environment)
);

alter table public.hermes_adaptive_rollouts enable row level security;
revoke all on public.hermes_adaptive_rollouts from anon, authenticated;
grant select on public.hermes_adaptive_rollouts to authenticated;
grant all on public.hermes_adaptive_rollouts to service_role;
create policy "owners read adaptive rollouts"
on public.hermes_adaptive_rollouts for select to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.hermes_review_adaptive_promotion(
  p_candidate_id uuid,
  p_user_id uuid,
  p_reviewer_id uuid,
  p_decision text,
  p_rationale text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate public.hermes_adaptive_promotion_candidates%rowtype;
  v_review_id uuid;
begin
  if p_decision not in ('approved','rejected') then raise exception 'invalid promotion decision'; end if;
  if char_length(btrim(coalesce(p_rationale,''))) < 3 then raise exception 'promotion rationale required'; end if;

  select * into v_candidate
  from public.hermes_adaptive_promotion_candidates
  where id=p_candidate_id and user_id=p_user_id
  for update;

  if not found then raise exception 'promotion candidate not found'; end if;
  if v_candidate.status <> 'pending_promotion_review' then raise exception 'promotion candidate already reviewed'; end if;

  insert into public.hermes_adaptive_promotion_reviews(
    user_id,promotion_candidate_id,reviewer_id,decision,rationale
  ) values (
    p_user_id,p_candidate_id,p_reviewer_id,p_decision,p_rationale
  ) returning id into v_review_id;

  update public.hermes_adaptive_promotion_candidates
  set status=p_decision
  where id=p_candidate_id;

  insert into public.hermes_adaptive_change_audit(
    user_id,change_request_id,actor_id,event_type,event_data
  )
  select p_user_id,change_request_id,p_reviewer_id,
         'promotion.' || p_decision,
         jsonb_build_object('promotion_candidate_id',p_candidate_id,'review_id',v_review_id,'rationale',p_rationale)
  from public.hermes_adaptive_promotion_candidates
  where id=p_candidate_id;

  return jsonb_build_object('candidate_id',p_candidate_id,'review_id',v_review_id,'decision',p_decision);
end;
$$;

revoke all on function public.hermes_review_adaptive_promotion(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.hermes_review_adaptive_promotion(uuid,uuid,uuid,text,text) to service_role;

create or replace function public.hermes_validate_adaptive_rollout(
  p_candidate_id uuid,
  p_user_id uuid,
  p_executor_id uuid,
  p_environment text,
  p_authorization_hash text,
  p_pre_change jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate public.hermes_adaptive_promotion_candidates%rowtype;
  v_review public.hermes_adaptive_promotion_reviews%rowtype;
  v_rollout_id uuid;
begin
  if p_environment not in ('staging','production') then raise exception 'invalid rollout environment'; end if;
  if p_environment='production' and coalesce(p_authorization_hash,'')='' then
    raise exception 'explicit production authorization required';
  end if;

  select * into v_candidate
  from public.hermes_adaptive_promotion_candidates
  where id=p_candidate_id and user_id=p_user_id
  for update;

  if not found then raise exception 'promotion candidate not found'; end if;
  if v_candidate.status <> 'approved' then raise exception 'approved promotion candidate required'; end if;

  select * into v_review
  from public.hermes_adaptive_promotion_reviews
  where promotion_candidate_id=p_candidate_id and decision='approved'
  limit 1;

  if not found then raise exception 'approved promotion review required'; end if;

  insert into public.hermes_adaptive_rollouts(
    user_id,promotion_candidate_id,promotion_review_id,executor_id,environment,
    authorization_token_hash,pre_change_config,approved_delta,post_change_config,rollback_config,
    status,runtime_changed
  ) values (
    p_user_id,p_candidate_id,v_review.id,p_executor_id,p_environment,
    p_authorization_hash,p_pre_change,v_candidate.proposed_change,
    p_pre_change || jsonb_build_object('approved_delta',v_candidate.proposed_change,'effective_runtime_changed',false),
    p_pre_change,'validated',false
  )
  on conflict (promotion_candidate_id, environment) do update
    set promotion_review_id = excluded.promotion_review_id,
        executor_id = excluded.executor_id,
        authorization_token_hash = excluded.authorization_token_hash,
        pre_change_config = excluded.pre_change_config,
        approved_delta = excluded.approved_delta,
        post_change_config = excluded.post_change_config,
        rollback_config = excluded.rollback_config,
        status = 'validated',
        runtime_changed = false,
        deployment_evidence = '{}'::jsonb,
        updated_at = now()
  returning id into v_rollout_id;

  insert into public.hermes_adaptive_change_audit(
    user_id,change_request_id,actor_id,event_type,event_data
  )
  select p_user_id,change_request_id,p_executor_id,'promotion.rollout_validated',
         jsonb_build_object('promotion_candidate_id',p_candidate_id,'rollout_id',v_rollout_id,'environment',p_environment,'runtime_changed',false)
  from public.hermes_adaptive_promotion_candidates
  where id=p_candidate_id;

  return jsonb_build_object(
    'status','rollout_validated',
    'rollout_id',v_rollout_id,
    'runtime_changed',false,
    'production_applied',false,
    'rollback_ready',true
  );
end;
$$;

revoke all on function public.hermes_validate_adaptive_rollout(uuid,uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.hermes_validate_adaptive_rollout(uuid,uuid,uuid,text,text,jsonb) to service_role;
