create table if not exists nonprofit.production_execution_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  promotion_id uuid not null references nonprofit.production_connector_promotions(id),
  shadow_run_id uuid not null references nonprofit.production_connector_shadow_runs(id),
  request_body_hash text not null,
  token_hash text not null unique,
  issued_by text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by text,
  status text not null default 'ISSUED',
  production_execution_enabled boolean not null default false,
  check (status in ('ISSUED','CONSUMED','EXPIRED','REVOKED')),
  check (production_execution_enabled = false),
  check (expires_at > issued_at)
);

create unique index if not exists production_execution_tokens_one_live_per_shadow
on nonprofit.production_execution_tokens(shadow_run_id)
where status = 'ISSUED';

alter table nonprofit.production_execution_tokens enable row level security;

create policy production_execution_tokens_member_read
on nonprofit.production_execution_tokens
for select to authenticated
using (
  exists (
    select 1 from nonprofit_security.memberships m
    where m.organization_id = production_execution_tokens.organization_id
      and m.user_id = auth.uid()
      and m.active
  )
);

revoke insert, update, delete on nonprofit.production_execution_tokens from authenticated;
grant select on nonprofit.production_execution_tokens to authenticated;

create or replace function nonprofit_api.issue_production_execution_token(
  p_shadow_run_id uuid,
  p_plaintext_token text,
  p_issued_by text,
  p_ttl_seconds integer default 300
)
returns table (
  execution_token_id uuid,
  token_status text,
  request_body_hash text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shadow record;
  v_id uuid := gen_random_uuid();
  v_token_hash text;
  v_expires timestamptz;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  if p_plaintext_token is null or length(p_plaintext_token) < 32 then
    raise exception 'EXECUTION_TOKEN_MINIMUM_ENTROPY_REQUIRED' using errcode = '22023';
  end if;

  if p_ttl_seconds < 60 or p_ttl_seconds > 600 then
    raise exception 'EXECUTION_TOKEN_TTL_OUT_OF_RANGE' using errcode = '22023';
  end if;

  select s.* into v_shadow
  from public.nonprofit_production_connector_shadow_runs_v1 s
  where s.shadow_run_id = p_shadow_run_id;

  if not found then
    raise exception 'SHADOW_RUN_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not v_shadow.shadow_certified
     or v_shadow.shadow_status <> 'SHADOW_VALID'
     or v_shadow.network_probe_performed
     or v_shadow.application_payload_transmitted
     or v_shadow.production_execution_enabled
     or v_shadow.production_send_available then
    raise exception 'VALID_SHADOW_REQUIRED_FOR_TOKEN' using errcode = '42501';
  end if;

  update nonprofit.production_execution_tokens
  set status = 'EXPIRED'
  where shadow_run_id = p_shadow_run_id
    and status = 'ISSUED'
    and expires_at <= now();

  if exists (
    select 1
    from nonprofit.production_execution_tokens t
    where t.shadow_run_id = p_shadow_run_id
      and t.status = 'ISSUED'
      and t.expires_at > now()
  ) then
    raise exception 'LIVE_EXECUTION_TOKEN_ALREADY_EXISTS' using errcode = '55000';
  end if;

  v_token_hash := encode(extensions.digest(convert_to(p_plaintext_token, 'UTF8'), 'sha256'), 'hex');
  v_expires := now() + make_interval(secs => p_ttl_seconds);

  insert into nonprofit.production_execution_tokens (
    id, organization_id, promotion_id, shadow_run_id,
    request_body_hash, token_hash, issued_by, issued_at,
    expires_at, status, production_execution_enabled
  ) values (
    v_id, v_shadow.organization_id, v_shadow.promotion_id, v_shadow.shadow_run_id,
    v_shadow.request_body_hash, v_token_hash, nullif(btrim(p_issued_by),''),
    now(), v_expires, 'ISSUED', false
  );

  return query select v_id, 'ISSUED'::text, v_shadow.request_body_hash, v_expires;
end;
$$;

revoke all on function nonprofit_api.issue_production_execution_token(uuid,text,text,integer) from public;
revoke all on function nonprofit_api.issue_production_execution_token(uuid,text,text,integer) from anon;
revoke all on function nonprofit_api.issue_production_execution_token(uuid,text,text,integer) from authenticated;
grant execute on function nonprofit_api.issue_production_execution_token(uuid,text,text,integer) to service_role;

create or replace function public.nonprofit_issue_production_execution_token(
  p_shadow_run_id uuid,
  p_plaintext_token text,
  p_issued_by text,
  p_ttl_seconds integer default 300
)
returns table (
  execution_token_id uuid,
  token_status text,
  request_body_hash text,
  expires_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from nonprofit_api.issue_production_execution_token(
    p_shadow_run_id,
    p_plaintext_token,
    p_issued_by,
    p_ttl_seconds
  );
$$;

revoke all on function public.nonprofit_issue_production_execution_token(uuid,text,text,integer) from public;
revoke all on function public.nonprofit_issue_production_execution_token(uuid,text,text,integer) from anon;
revoke all on function public.nonprofit_issue_production_execution_token(uuid,text,text,integer) from authenticated;
grant execute on function public.nonprofit_issue_production_execution_token(uuid,text,text,integer) to service_role;

create or replace function nonprofit_api.validate_production_preflight(
  p_shadow_run_id uuid
)
returns table (
  shadow_run_id uuid,
  promotion_id uuid,
  request_body_hash text,
  shadow_certified boolean,
  execution_token_status text,
  execution_token_expires_at timestamptz,
  preflight_status text,
  production_send_available boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_aal text := (select auth.jwt() ->> 'aal');
  v_shadow record;
  v_token nonprofit.production_execution_tokens%rowtype;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if v_aal is distinct from 'aal2' then
    raise exception 'MFA_AAL2_REQUIRED' using errcode = '42501';
  end if;

  select s.* into v_shadow
  from public.nonprofit_production_connector_shadow_runs_v1 s
  where s.shadow_run_id = p_shadow_run_id;

  if not found then
    raise exception 'SHADOW_RUN_NOT_FOUND_OR_NOT_VISIBLE' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from nonprofit_security.memberships m
    where m.organization_id = v_shadow.organization_id
      and m.user_id = v_user
      and m.active
      and m.can_approve
  ) then
    raise exception 'PREFLIGHT_OPERATOR_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if not v_shadow.shadow_certified
     or v_shadow.shadow_status <> 'SHADOW_VALID'
     or v_shadow.network_probe_performed
     or v_shadow.application_payload_transmitted
     or v_shadow.production_execution_enabled
     or v_shadow.production_send_available then
    raise exception 'SHADOW_STATE_CHANGED_REVALIDATION_REQUIRED' using errcode = '42501';
  end if;

  update nonprofit.production_execution_tokens
  set status = 'EXPIRED'
  where shadow_run_id = p_shadow_run_id
    and status = 'ISSUED'
    and expires_at <= now();

  select t.* into v_token
  from nonprofit.production_execution_tokens t
  where t.shadow_run_id = p_shadow_run_id
    and t.status = 'ISSUED'
    and t.expires_at > now()
  order by t.issued_at desc
  limit 1;

  if not found then
    return query select
      v_shadow.shadow_run_id,
      v_shadow.promotion_id,
      v_shadow.request_body_hash,
      v_shadow.shadow_certified,
      'MISSING'::text,
      null::timestamptz,
      'BLOCKED_TOKEN_REQUIRED'::text,
      false;
    return;
  end if;

  if v_token.request_body_hash <> v_shadow.request_body_hash then
    return query select
      v_shadow.shadow_run_id,
      v_shadow.promotion_id,
      v_shadow.request_body_hash,
      v_shadow.shadow_certified,
      v_token.status,
      v_token.expires_at,
      'BLOCKED_HASH_MISMATCH'::text,
      false;
    return;
  end if;

  return query select
    v_shadow.shadow_run_id,
    v_shadow.promotion_id,
    v_shadow.request_body_hash,
    v_shadow.shadow_certified,
    v_token.status,
    v_token.expires_at,
    'PREFLIGHT_CERTIFIED'::text,
    false;
end;
$$;

revoke all on function nonprofit_api.validate_production_preflight(uuid) from public;
revoke all on function nonprofit_api.validate_production_preflight(uuid) from anon;
grant execute on function nonprofit_api.validate_production_preflight(uuid) to authenticated;

create or replace function public.nonprofit_validate_production_preflight(
  p_shadow_run_id uuid
)
returns table (
  shadow_run_id uuid,
  promotion_id uuid,
  request_body_hash text,
  shadow_certified boolean,
  execution_token_status text,
  execution_token_expires_at timestamptz,
  preflight_status text,
  production_send_available boolean
)
language sql
security invoker
set search_path = ''
as $$
  select * from nonprofit_api.validate_production_preflight(p_shadow_run_id);
$$;

revoke all on function public.nonprofit_validate_production_preflight(uuid) from public;
revoke all on function public.nonprofit_validate_production_preflight(uuid) from anon;
grant execute on function public.nonprofit_validate_production_preflight(uuid) to authenticated;

create or replace view public.nonprofit_production_execution_tokens_v1
with (security_invoker = true)
as
select
  t.id as execution_token_id,
  t.organization_id,
  t.promotion_id,
  t.shadow_run_id,
  t.request_body_hash,
  t.issued_by,
  t.issued_at,
  t.expires_at,
  t.consumed_at,
  t.consumed_by,
  case
    when t.status = 'ISSUED' and t.expires_at <= now() then 'EXPIRED'
    else t.status
  end as token_status,
  (t.status = 'ISSUED' and t.expires_at > now()) as token_live,
  false as plaintext_token_exposed,
  false as production_execution_enabled
from nonprofit.production_execution_tokens t;

grant select on public.nonprofit_production_execution_tokens_v1 to authenticated;
revoke all on public.nonprofit_production_execution_tokens_v1 from anon;

create or replace view public.nonprofit_production_preflight_v1
with (security_invoker = true)
as
select
  s.shadow_run_id,
  s.organization_id,
  s.promotion_id,
  s.request_body_hash,
  s.shadow_certified,
  t.execution_token_id,
  t.token_status,
  t.token_live,
  t.expires_at as execution_token_expires_at,
  (
    s.shadow_certified
    and coalesce(t.token_live, false)
    and t.request_body_hash = s.request_body_hash
    and not s.network_probe_performed
    and not s.application_payload_transmitted
    and not s.production_execution_enabled
    and not s.production_send_available
  ) as preflight_certified,
  case
    when not s.shadow_certified then 'BLOCKED_SHADOW_INVALID'
    when t.execution_token_id is null then 'BLOCKED_TOKEN_REQUIRED'
    when not t.token_live then 'BLOCKED_TOKEN_EXPIRED'
    when t.request_body_hash <> s.request_body_hash then 'BLOCKED_HASH_MISMATCH'
    else 'PREFLIGHT_CERTIFIED'
  end as preflight_status,
  false as production_send_available
from public.nonprofit_production_connector_shadow_runs_v1 s
left join lateral (
  select tv.*
  from public.nonprofit_production_execution_tokens_v1 tv
  where tv.shadow_run_id = s.shadow_run_id
  order by tv.issued_at desc
  limit 1
) t on true;

grant select on public.nonprofit_production_preflight_v1 to authenticated;
revoke all on public.nonprofit_production_preflight_v1 from anon;
