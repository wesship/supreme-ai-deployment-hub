create table if not exists nonprofit.sandbox_receipt_certifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  connector_kind text not null,
  endpoint_host text not null,
  acknowledged_count integer not null,
  distinct_workflow_count integer not null,
  failed_or_blocked_count integer not null,
  evidence_window_start timestamptz not null,
  evidence_window_end timestamptz not null,
  evidence_hash text not null,
  certified_by uuid not null,
  certified_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  status text not null default 'CERTIFIED',
  check (acknowledged_count >= 3),
  check (distinct_workflow_count >= 2),
  check (failed_or_blocked_count = 0),
  check (status = 'CERTIFIED')
);

create table if not exists nonprofit.production_connector_promotions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  sandbox_certification_id uuid not null references nonprofit.sandbox_receipt_certifications(id),
  connector_kind text not null,
  production_contract jsonb not null,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  protected_environment_approval_required boolean not null default true,
  protected_environment_approval_ref text,
  protected_environment_approved_at timestamptz,
  protected_environment_approved_by text,
  promotion_status text not null default 'PENDING_PROTECTED_ENVIRONMENT',
  production_execution_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (promotion_status in ('PENDING_PROTECTED_ENVIRONMENT','APPROVED_FOR_IMPLEMENTATION','REJECTED','EXPIRED')),
  check (production_execution_enabled = false)
);

alter table nonprofit.sandbox_receipt_certifications enable row level security;
alter table nonprofit.production_connector_promotions enable row level security;

create policy sandbox_receipt_certifications_member_read
on nonprofit.sandbox_receipt_certifications
for select to authenticated
using (
  exists (
    select 1 from nonprofit_security.memberships m
    where m.organization_id = sandbox_receipt_certifications.organization_id
      and m.user_id = auth.uid()
      and m.active
  )
);

create policy production_connector_promotions_member_read
on nonprofit.production_connector_promotions
for select to authenticated
using (
  exists (
    select 1 from nonprofit_security.memberships m
    where m.organization_id = production_connector_promotions.organization_id
      and m.user_id = auth.uid()
      and m.active
  )
);

revoke insert, update, delete on nonprofit.sandbox_receipt_certifications from authenticated;
revoke insert, update, delete on nonprofit.production_connector_promotions from authenticated;
grant select on nonprofit.sandbox_receipt_certifications to authenticated;
grant select on nonprofit.production_connector_promotions to authenticated;

create or replace function nonprofit_api.certify_sandbox_receipts(
  p_connector_kind text,
  p_endpoint_host text
)
returns table (
  certification_id uuid,
  certification_status text,
  acknowledged_count integer,
  distinct_workflow_count integer,
  evidence_hash text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_aal text := (select auth.jwt() ->> 'aal');
  v_org uuid;
  v_ack integer;
  v_workflows integer;
  v_failed integer;
  v_start timestamptz;
  v_end timestamptz;
  v_evidence jsonb;
  v_hash text;
  v_id uuid := gen_random_uuid();
  v_expires timestamptz := now() + interval '30 days';
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if v_aal is distinct from 'aal2' then
    raise exception 'MFA_AAL2_REQUIRED' using errcode = '42501';
  end if;

  select m.organization_id into v_org
  from nonprofit_security.memberships m
  where m.user_id = v_user
    and m.active
    and m.can_approve
  order by m.organization_id
  limit 1;

  if v_org is null then
    raise exception 'CERTIFIER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  select
    count(*) filter (where t.request_status = 'ACKNOWLEDGED' and t.sandbox_connector_certified),
    count(distinct t.workflow_id) filter (where t.request_status = 'ACKNOWLEDGED' and t.sandbox_connector_certified),
    count(*) filter (where t.request_status in ('FAILED','BLOCKED')),
    min(t.requested_at),
    max(coalesce(t.completed_at, t.requested_at))
  into v_ack, v_workflows, v_failed, v_start, v_end
  from public.nonprofit_external_sandbox_transmissions_v1 t
  where t.organization_id = v_org
    and t.connector_kind = p_connector_kind
    and lower(t.endpoint_host) = lower(p_endpoint_host)
    and t.requested_at >= now() - interval '30 days';

  if coalesce(v_ack,0) < 3 then
    raise exception 'THREE_ACKNOWLEDGED_SANDBOX_RECEIPTS_REQUIRED' using errcode = '42501';
  end if;

  if coalesce(v_workflows,0) < 2 then
    raise exception 'TWO_DISTINCT_WORKFLOWS_REQUIRED' using errcode = '42501';
  end if;

  if coalesce(v_failed,0) > 0 then
    raise exception 'FAILED_OR_BLOCKED_SANDBOX_RECEIPTS_PRESENT' using errcode = '42501';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'transmission_id', t.transmission_id,
      'workflow_id', t.workflow_id,
      'payload_hash', t.payload_hash,
      'idempotency_key', t.idempotency_key,
      'request_status', t.request_status,
      'response_status', t.response_status,
      'response_body_hash', t.response_body_hash,
      'completed_at', t.completed_at
    )
    order by t.requested_at, t.transmission_id
  ) into v_evidence
  from public.nonprofit_external_sandbox_transmissions_v1 t
  where t.organization_id = v_org
    and t.connector_kind = p_connector_kind
    and lower(t.endpoint_host) = lower(p_endpoint_host)
    and t.requested_at >= now() - interval '30 days';

  v_hash := encode(extensions.digest(convert_to(coalesce(v_evidence,'[]'::jsonb)::text, 'UTF8'), 'sha256'), 'hex');

  insert into nonprofit.sandbox_receipt_certifications (
    id, organization_id, connector_kind, endpoint_host,
    acknowledged_count, distinct_workflow_count, failed_or_blocked_count,
    evidence_window_start, evidence_window_end, evidence_hash,
    certified_by, certified_at, expires_at
  ) values (
    v_id, v_org, p_connector_kind, lower(p_endpoint_host),
    v_ack, v_workflows, v_failed,
    v_start, v_end, v_hash,
    v_user, now(), v_expires
  );

  return query select v_id, 'CERTIFIED'::text, v_ack, v_workflows, v_hash, v_expires;
end;
$$;

revoke all on function nonprofit_api.certify_sandbox_receipts(text,text) from public;
revoke all on function nonprofit_api.certify_sandbox_receipts(text,text) from anon;
grant execute on function nonprofit_api.certify_sandbox_receipts(text,text) to authenticated;

create or replace function public.nonprofit_certify_sandbox_receipts(
  p_connector_kind text,
  p_endpoint_host text
)
returns table (
  certification_id uuid,
  certification_status text,
  acknowledged_count integer,
  distinct_workflow_count integer,
  evidence_hash text,
  expires_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from nonprofit_api.certify_sandbox_receipts(p_connector_kind, p_endpoint_host);
$$;

revoke all on function public.nonprofit_certify_sandbox_receipts(text,text) from public;
revoke all on function public.nonprofit_certify_sandbox_receipts(text,text) from anon;
grant execute on function public.nonprofit_certify_sandbox_receipts(text,text) to authenticated;

create or replace function nonprofit_api.request_production_connector_promotion(
  p_sandbox_certification_id uuid,
  p_production_contract jsonb
)
returns table (
  promotion_id uuid,
  promotion_status text,
  production_execution_enabled boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_cert nonprofit.sandbox_receipt_certifications%rowtype;
  v_id uuid := gen_random_uuid();
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_cert
  from nonprofit.sandbox_receipt_certifications
  where id = p_sandbox_certification_id;

  if not found then
    raise exception 'SANDBOX_CERTIFICATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_cert.expires_at <= now() then
    raise exception 'SANDBOX_CERTIFICATION_EXPIRED' using errcode = '42501';
  end if;

  if not exists (
    select 1 from nonprofit_security.memberships m
    where m.organization_id = v_cert.organization_id
      and m.user_id = v_user
      and m.active
      and m.can_approve
  ) then
    raise exception 'PROMOTION_REQUESTER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if coalesce((p_production_contract ->> 'tls_required')::boolean, false) is distinct from true
     or coalesce((p_production_contract ->> 'idempotency_required')::boolean, false) is distinct from true
     or coalesce((p_production_contract ->> 'payload_hash_required')::boolean, false) is distinct from true
     or coalesce((p_production_contract ->> 'receipt_hash_required')::boolean, false) is distinct from true then
    raise exception 'PRODUCTION_CONTRACT_GUARDS_REQUIRED' using errcode = '22023';
  end if;

  insert into nonprofit.production_connector_promotions (
    id, organization_id, sandbox_certification_id, connector_kind,
    production_contract, requested_by, promotion_status,
    production_execution_enabled
  ) values (
    v_id, v_cert.organization_id, v_cert.id, v_cert.connector_kind,
    p_production_contract, v_user, 'PENDING_PROTECTED_ENVIRONMENT', false
  );

  return query select v_id, 'PENDING_PROTECTED_ENVIRONMENT'::text, false;
end;
$$;

revoke all on function nonprofit_api.request_production_connector_promotion(uuid,jsonb) from public;
revoke all on function nonprofit_api.request_production_connector_promotion(uuid,jsonb) from anon;
grant execute on function nonprofit_api.request_production_connector_promotion(uuid,jsonb) to authenticated;

create or replace function public.nonprofit_request_production_connector_promotion(
  p_sandbox_certification_id uuid,
  p_production_contract jsonb
)
returns table (
  promotion_id uuid,
  promotion_status text,
  production_execution_enabled boolean
)
language sql
security invoker
set search_path = ''
as $$
  select * from nonprofit_api.request_production_connector_promotion(
    p_sandbox_certification_id,
    p_production_contract
  );
$$;

revoke all on function public.nonprofit_request_production_connector_promotion(uuid,jsonb) from public;
revoke all on function public.nonprofit_request_production_connector_promotion(uuid,jsonb) from anon;
grant execute on function public.nonprofit_request_production_connector_promotion(uuid,jsonb) to authenticated;

create or replace function nonprofit_api.record_protected_environment_approval(
  p_promotion_id uuid,
  p_approval_ref text,
  p_approved_by text
)
returns table (
  promotion_id uuid,
  promotion_status text,
  production_execution_enabled boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_promotion nonprofit.production_connector_promotions%rowtype;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  select * into v_promotion
  from nonprofit.production_connector_promotions
  where id = p_promotion_id
  for update;

  if not found then
    raise exception 'PROMOTION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_promotion.promotion_status <> 'PENDING_PROTECTED_ENVIRONMENT' then
    raise exception 'PROMOTION_NOT_PENDING' using errcode = '55000';
  end if;

  if p_approval_ref is null or length(btrim(p_approval_ref)) = 0 then
    raise exception 'PROTECTED_ENVIRONMENT_APPROVAL_REF_REQUIRED' using errcode = '22023';
  end if;

  update nonprofit.production_connector_promotions
  set protected_environment_approval_ref = btrim(p_approval_ref),
      protected_environment_approved_at = now(),
      protected_environment_approved_by = nullif(btrim(p_approved_by),''),
      promotion_status = 'APPROVED_FOR_IMPLEMENTATION',
      production_execution_enabled = false,
      updated_at = now()
  where id = p_promotion_id;

  return query select p_promotion_id, 'APPROVED_FOR_IMPLEMENTATION'::text, false;
end;
$$;

revoke all on function nonprofit_api.record_protected_environment_approval(uuid,text,text) from public;
revoke all on function nonprofit_api.record_protected_environment_approval(uuid,text,text) from anon;
revoke all on function nonprofit_api.record_protected_environment_approval(uuid,text,text) from authenticated;
grant execute on function nonprofit_api.record_protected_environment_approval(uuid,text,text) to service_role;

create or replace view public.nonprofit_sandbox_receipt_certifications_v1
with (security_invoker = true)
as
select
  c.*,
  (c.expires_at > now() and c.status = 'CERTIFIED') as certification_valid
from nonprofit.sandbox_receipt_certifications c;

grant select on public.nonprofit_sandbox_receipt_certifications_v1 to authenticated;
revoke all on public.nonprofit_sandbox_receipt_certifications_v1 from anon;

create or replace view public.nonprofit_production_connector_promotions_v1
with (security_invoker = true)
as
select
  p.id as promotion_id,
  p.organization_id,
  p.sandbox_certification_id,
  p.connector_kind,
  p.production_contract,
  p.requested_by,
  p.requested_at,
  p.protected_environment_approval_required,
  p.protected_environment_approval_ref,
  p.protected_environment_approved_at,
  p.protected_environment_approved_by,
  p.promotion_status,
  p.production_execution_enabled,
  c.evidence_hash,
  c.certification_valid as sandbox_certification_valid,
  (
    p.promotion_status = 'APPROVED_FOR_IMPLEMENTATION'
    and p.protected_environment_approved_at is not null
    and c.certification_valid
    and p.production_execution_enabled = false
  ) as promotion_prerequisites_met,
  false as production_send_available
from nonprofit.production_connector_promotions p
join public.nonprofit_sandbox_receipt_certifications_v1 c
  on c.id = p.sandbox_certification_id;

grant select on public.nonprofit_production_connector_promotions_v1 to authenticated;
revoke all on public.nonprofit_production_connector_promotions_v1 from anon;
