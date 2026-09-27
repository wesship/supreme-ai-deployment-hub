create table if not exists nonprofit.production_connector_shadow_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  promotion_id uuid not null references nonprofit.production_connector_promotions(id),
  sandbox_certification_id uuid not null,
  connector_kind text not null,
  production_endpoint_host text not null,
  credential_profile_present boolean not null,
  tls_validated boolean not null,
  host_allowlisted boolean not null,
  protected_environment_approval_present boolean not null,
  request_method text not null,
  request_headers jsonb not null,
  request_body_hash text not null,
  idempotency_key text not null,
  receipt_parser_contract jsonb not null,
  shadow_status text not null,
  network_probe_performed boolean not null default false,
  application_payload_transmitted boolean not null default false,
  production_execution_enabled boolean not null default false,
  generated_by uuid not null,
  generated_at timestamptz not null default now(),
  check (request_method = 'POST'),
  check (shadow_status in ('SHADOW_VALID','SHADOW_BLOCKED')),
  check (network_probe_performed = false),
  check (application_payload_transmitted = false),
  check (production_execution_enabled = false)
);

create unique index if not exists production_connector_shadow_runs_one_per_promotion_hash
on nonprofit.production_connector_shadow_runs(promotion_id, request_body_hash);

alter table nonprofit.production_connector_shadow_runs enable row level security;

create policy production_connector_shadow_runs_member_read
on nonprofit.production_connector_shadow_runs
for select to authenticated
using (
  exists (
    select 1 from nonprofit_security.memberships m
    where m.organization_id = production_connector_shadow_runs.organization_id
      and m.user_id = auth.uid()
      and m.active
  )
);

revoke insert, update, delete on nonprofit.production_connector_shadow_runs from authenticated;
grant select on nonprofit.production_connector_shadow_runs to authenticated;

create or replace function nonprofit_api.prepare_production_shadow(
  p_promotion_id uuid
)
returns table (
  promotion_id uuid,
  organization_id uuid,
  connector_kind text,
  sandbox_certification_id uuid,
  production_contract jsonb,
  protected_environment_approval_ref text,
  evidence_hash text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_aal text := (select auth.jwt() ->> 'aal');
  v_promotion record;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if v_aal is distinct from 'aal2' then
    raise exception 'MFA_AAL2_REQUIRED' using errcode = '42501';
  end if;

  select p.* into v_promotion
  from public.nonprofit_production_connector_promotions_v1 p
  where p.promotion_id = p_promotion_id;

  if not found then
    raise exception 'PROMOTION_NOT_FOUND_OR_NOT_VISIBLE' using errcode = 'P0002';
  end if;

  if v_promotion.promotion_status <> 'APPROVED_FOR_IMPLEMENTATION'
     or not v_promotion.promotion_prerequisites_met then
    raise exception 'PROMOTION_NOT_APPROVED_FOR_IMPLEMENTATION' using errcode = '42501';
  end if;

  if v_promotion.protected_environment_approval_ref is null then
    raise exception 'PROTECTED_ENVIRONMENT_APPROVAL_REQUIRED' using errcode = '42501';
  end if;

  if v_promotion.production_execution_enabled
     or v_promotion.production_send_available then
    raise exception 'PRODUCTION_EXECUTION_MUST_REMAIN_DISABLED' using errcode = '42501';
  end if;

  if not exists (
    select 1 from nonprofit_security.memberships m
    where m.organization_id = v_promotion.organization_id
      and m.user_id = v_user
      and m.active
      and m.can_approve
  ) then
    raise exception 'SHADOW_OPERATOR_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  return query
  select
    v_promotion.promotion_id,
    v_promotion.organization_id,
    v_promotion.connector_kind,
    v_promotion.sandbox_certification_id,
    v_promotion.production_contract,
    v_promotion.protected_environment_approval_ref,
    v_promotion.evidence_hash;
end;
$$;

revoke all on function nonprofit_api.prepare_production_shadow(uuid) from public;
revoke all on function nonprofit_api.prepare_production_shadow(uuid) from anon;
grant execute on function nonprofit_api.prepare_production_shadow(uuid) to authenticated;

create or replace function public.nonprofit_prepare_production_shadow(
  p_promotion_id uuid
)
returns table (
  promotion_id uuid,
  organization_id uuid,
  connector_kind text,
  sandbox_certification_id uuid,
  production_contract jsonb,
  protected_environment_approval_ref text,
  evidence_hash text
)
language sql
security invoker
set search_path = ''
as $$
  select * from nonprofit_api.prepare_production_shadow(p_promotion_id);
$$;

revoke all on function public.nonprofit_prepare_production_shadow(uuid) from public;
revoke all on function public.nonprofit_prepare_production_shadow(uuid) from anon;
grant execute on function public.nonprofit_prepare_production_shadow(uuid) to authenticated;

create or replace function nonprofit_api.record_production_shadow_run(
  p_promotion_id uuid,
  p_production_endpoint_host text,
  p_credential_profile_present boolean,
  p_tls_validated boolean,
  p_host_allowlisted boolean,
  p_protected_environment_approval_present boolean,
  p_request_headers jsonb,
  p_request_body_hash text,
  p_idempotency_key text,
  p_receipt_parser_contract jsonb,
  p_shadow_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_promotion nonprofit.production_connector_promotions%rowtype;
  v_id uuid := gen_random_uuid();
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  select * into v_promotion
  from nonprofit.production_connector_promotions
  where id = p_promotion_id;

  if not found then
    raise exception 'PROMOTION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_shadow_status not in ('SHADOW_VALID','SHADOW_BLOCKED') then
    raise exception 'INVALID_SHADOW_STATUS' using errcode = '22023';
  end if;

  insert into nonprofit.production_connector_shadow_runs (
    id, organization_id, promotion_id, sandbox_certification_id, connector_kind,
    production_endpoint_host, credential_profile_present, tls_validated,
    host_allowlisted, protected_environment_approval_present, request_method,
    request_headers, request_body_hash, idempotency_key, receipt_parser_contract,
    shadow_status, network_probe_performed, application_payload_transmitted,
    production_execution_enabled, generated_by
  ) values (
    v_id, v_promotion.organization_id, v_promotion.id, v_promotion.sandbox_certification_id,
    v_promotion.connector_kind, lower(btrim(p_production_endpoint_host)),
    p_credential_profile_present, p_tls_validated, p_host_allowlisted,
    p_protected_environment_approval_present, 'POST',
    p_request_headers, p_request_body_hash, p_idempotency_key,
    p_receipt_parser_contract, p_shadow_status, false, false, false,
    coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid)
  )
  on conflict (promotion_id, request_body_hash) do update
    set generated_at = now(),
        shadow_status = excluded.shadow_status
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function nonprofit_api.record_production_shadow_run(uuid,text,boolean,boolean,boolean,boolean,jsonb,text,text,jsonb,text) from public;
revoke all on function nonprofit_api.record_production_shadow_run(uuid,text,boolean,boolean,boolean,boolean,jsonb,text,text,jsonb,text) from anon;
revoke all on function nonprofit_api.record_production_shadow_run(uuid,text,boolean,boolean,boolean,boolean,jsonb,text,text,jsonb,text) from authenticated;
grant execute on function nonprofit_api.record_production_shadow_run(uuid,text,boolean,boolean,boolean,boolean,jsonb,text,text,jsonb,text) to service_role;

create or replace function public.nonprofit_record_production_shadow_run(
  p_promotion_id uuid,
  p_production_endpoint_host text,
  p_credential_profile_present boolean,
  p_tls_validated boolean,
  p_host_allowlisted boolean,
  p_protected_environment_approval_present boolean,
  p_request_headers jsonb,
  p_request_body_hash text,
  p_idempotency_key text,
  p_receipt_parser_contract jsonb,
  p_shadow_status text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select nonprofit_api.record_production_shadow_run(
    p_promotion_id,
    p_production_endpoint_host,
    p_credential_profile_present,
    p_tls_validated,
    p_host_allowlisted,
    p_protected_environment_approval_present,
    p_request_headers,
    p_request_body_hash,
    p_idempotency_key,
    p_receipt_parser_contract,
    p_shadow_status
  );
$$;

revoke all on function public.nonprofit_record_production_shadow_run(uuid,text,boolean,boolean,boolean,boolean,jsonb,text,text,jsonb,text) from public;
revoke all on function public.nonprofit_record_production_shadow_run(uuid,text,boolean,boolean,boolean,boolean,jsonb,text,text,jsonb,text) from anon;
revoke all on function public.nonprofit_record_production_shadow_run(uuid,text,boolean,boolean,boolean,boolean,jsonb,text,text,jsonb,text) from authenticated;
grant execute on function public.nonprofit_record_production_shadow_run(uuid,text,boolean,boolean,boolean,boolean,jsonb,text,text,jsonb,text) to service_role;

create or replace view public.nonprofit_production_connector_shadow_runs_v1
with (security_invoker = true)
as
select
  s.id as shadow_run_id,
  s.organization_id,
  s.promotion_id,
  s.sandbox_certification_id,
  s.connector_kind,
  s.production_endpoint_host,
  s.credential_profile_present,
  s.tls_validated,
  s.host_allowlisted,
  s.protected_environment_approval_present,
  s.request_method,
  s.request_headers,
  s.request_body_hash,
  s.idempotency_key,
  s.receipt_parser_contract,
  s.shadow_status,
  s.network_probe_performed,
  s.application_payload_transmitted,
  s.production_execution_enabled,
  s.generated_at,
  p.promotion_status,
  p.promotion_prerequisites_met,
  p.production_send_available,
  (
    s.shadow_status = 'SHADOW_VALID'
    and s.credential_profile_present
    and s.tls_validated
    and s.host_allowlisted
    and s.protected_environment_approval_present
    and not s.network_probe_performed
    and not s.application_payload_transmitted
    and not s.production_execution_enabled
    and not p.production_send_available
  ) as shadow_certified
from nonprofit.production_connector_shadow_runs s
join public.nonprofit_production_connector_promotions_v1 p
  on p.promotion_id = s.promotion_id;

grant select on public.nonprofit_production_connector_shadow_runs_v1 to authenticated;
revoke all on public.nonprofit_production_connector_shadow_runs_v1 from anon;
