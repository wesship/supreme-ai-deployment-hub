create table if not exists nonprofit.external_sandbox_transmissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workflow_id uuid not null,
  certification_id uuid not null references nonprofit.submission_preview_certifications(id),
  preview_id uuid not null references nonprofit.submission_previews(id),
  connector_kind text not null,
  payload_hash text not null,
  idempotency_key text not null unique,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  endpoint_host text,
  request_status text not null default 'REQUESTED',
  response_status integer,
  response_body_hash text,
  response_receipt jsonb,
  completed_at timestamptz,
  production_destination boolean not null default false,
  check (request_status in ('REQUESTED','SENT','ACKNOWLEDGED','FAILED','BLOCKED')),
  check (production_destination = false)
);

alter table nonprofit.external_sandbox_transmissions enable row level security;

create policy external_sandbox_transmissions_member_read
on nonprofit.external_sandbox_transmissions
for select to authenticated
using (
  exists (
    select 1 from nonprofit_security.memberships m
    where m.organization_id = external_sandbox_transmissions.organization_id
      and m.user_id = auth.uid()
      and m.active
  )
);

revoke insert, update, delete on nonprofit.external_sandbox_transmissions from authenticated;
grant select on nonprofit.external_sandbox_transmissions to authenticated;

create or replace function nonprofit_api.prepare_external_sandbox_transmission(
  p_certification_id uuid
)
returns table (
  transmission_id uuid,
  certification_id uuid,
  workflow_id uuid,
  connector_kind text,
  payload_hash text,
  idempotency_key text,
  frozen_payload jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_aal text := (select auth.jwt() ->> 'aal');
  v_cert record;
  v_id uuid := gen_random_uuid();
  v_key text;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if v_aal is distinct from 'aal2' then
    raise exception 'MFA_AAL2_REQUIRED' using errcode = '42501';
  end if;

  select c.* into v_cert
  from public.nonprofit_submission_preview_certifications_v1 c
  where c.certification_id = p_certification_id;

  if not found then
    raise exception 'CERTIFICATION_NOT_FOUND_OR_NOT_VISIBLE' using errcode = 'P0002';
  end if;

  if not v_cert.certification_valid or v_cert.certification_status <> 'CERTIFIED_VALID' then
    raise exception 'VALID_CERTIFICATION_REQUIRED' using errcode = '42501';
  end if;

  if not exists (
    select 1 from nonprofit_security.memberships m
    where m.organization_id = v_cert.organization_id
      and m.user_id = v_user
      and m.active
      and m.can_approve
  ) then
    raise exception 'SANDBOX_TRANSMITTER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if v_cert.certified_by = v_user then
    raise exception 'SEPARATION_OF_DUTIES_REQUIRED' using errcode = '42501';
  end if;

  if v_cert.certified_payload_hash <> v_cert.current_payload_hash
     or not v_cert.hash_still_matches
     or not v_cert.package_unchanged then
    raise exception 'CERTIFIED_HASH_NO_LONGER_CURRENT' using errcode = '42501';
  end if;

  v_key := 'grantassist-sandbox-' || v_cert.certification_id::text || '-' || left(v_cert.certified_payload_hash, 20);

  insert into nonprofit.external_sandbox_transmissions (
    id, organization_id, workflow_id, certification_id, preview_id, connector_kind,
    payload_hash, idempotency_key, requested_by, request_status, production_destination
  ) values (
    v_id, v_cert.organization_id, v_cert.workflow_id, v_cert.certification_id,
    v_cert.preview_id, v_cert.connector_kind, v_cert.certified_payload_hash,
    v_key, v_user, 'REQUESTED', false
  )
  on conflict (idempotency_key) do update
    set requested_at = nonprofit.external_sandbox_transmissions.requested_at
  returning id into v_id;

  return query
  select
    v_id,
    v_cert.certification_id,
    v_cert.workflow_id,
    v_cert.connector_kind,
    v_cert.certified_payload_hash,
    v_key,
    v_cert.frozen_payload;
end;
$$;

revoke all on function nonprofit_api.prepare_external_sandbox_transmission(uuid) from public;
revoke all on function nonprofit_api.prepare_external_sandbox_transmission(uuid) from anon;
grant execute on function nonprofit_api.prepare_external_sandbox_transmission(uuid) to authenticated;

create or replace function public.nonprofit_prepare_external_sandbox_transmission(
  p_certification_id uuid
)
returns table (
  transmission_id uuid,
  certification_id uuid,
  workflow_id uuid,
  connector_kind text,
  payload_hash text,
  idempotency_key text,
  frozen_payload jsonb
)
language sql
security invoker
set search_path = ''
as $$
  select * from nonprofit_api.prepare_external_sandbox_transmission(p_certification_id);
$$;

revoke all on function public.nonprofit_prepare_external_sandbox_transmission(uuid) from public;
revoke all on function public.nonprofit_prepare_external_sandbox_transmission(uuid) from anon;
grant execute on function public.nonprofit_prepare_external_sandbox_transmission(uuid) to authenticated;

create or replace function nonprofit_api.record_external_sandbox_receipt(
  p_transmission_id uuid,
  p_endpoint_host text,
  p_request_status text,
  p_response_status integer,
  p_response_body_hash text,
  p_response_receipt jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx nonprofit.external_sandbox_transmissions%rowtype;
  v_event_id uuid := gen_random_uuid();
  v_event_at timestamptz := now();
  v_prev_hash text;
  v_event_hash text;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  select * into v_tx
  from nonprofit.external_sandbox_transmissions
  where id = p_transmission_id
  for update;

  if not found then
    raise exception 'TRANSMISSION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_endpoint_host is null or length(btrim(p_endpoint_host)) = 0 then
    raise exception 'ENDPOINT_HOST_REQUIRED' using errcode = '22023';
  end if;

  if p_request_status not in ('SENT','ACKNOWLEDGED','FAILED','BLOCKED') then
    raise exception 'INVALID_REQUEST_STATUS' using errcode = '22023';
  end if;

  update nonprofit.external_sandbox_transmissions
  set endpoint_host = lower(btrim(p_endpoint_host)),
      request_status = p_request_status,
      response_status = p_response_status,
      response_body_hash = p_response_body_hash,
      response_receipt = p_response_receipt,
      completed_at = now(),
      production_destination = false
  where id = p_transmission_id;

  select ae.event_hash into v_prev_hash
  from nonprofit_security.audit_events ae
  where ae.organization_id = v_tx.organization_id
  order by ae.event_at desc, ae.id desc
  limit 1;

  v_event_hash := encode(extensions.digest(
    concat_ws('|',
      coalesce(v_prev_hash,''),
      v_event_id::text,
      v_tx.organization_id::text,
      v_event_at::text,
      'SYSTEM',
      'external-sandbox-connector',
      'EXTERNAL_SANDBOX_TRANSMISSION_RECEIPT',
      v_tx.id::text,
      p_request_status,
      coalesce(p_response_body_hash,'')
    )::bytea,
    'sha256'
  ), 'hex');

  insert into nonprofit_security.audit_events (
    id, organization_id, event_at, actor_type, actor_id, event_type,
    resource_type, resource_id, action, result, previous_event_hash, event_hash
  ) values (
    v_event_id, v_tx.organization_id, v_event_at, 'SYSTEM', null,
    'EXTERNAL_SANDBOX_TRANSMISSION_RECEIPT', 'external_sandbox_transmission',
    v_tx.id, 'SANDBOX_NETWORK_CALL', p_request_status, v_prev_hash, v_event_hash
  );
end;
$$;

revoke all on function nonprofit_api.record_external_sandbox_receipt(uuid,text,text,integer,text,jsonb) from public;
revoke all on function nonprofit_api.record_external_sandbox_receipt(uuid,text,text,integer,text,jsonb) from anon;
revoke all on function nonprofit_api.record_external_sandbox_receipt(uuid,text,text,integer,text,jsonb) from authenticated;
grant execute on function nonprofit_api.record_external_sandbox_receipt(uuid,text,text,integer,text,jsonb) to service_role;

create or replace view public.nonprofit_external_sandbox_transmissions_v1
with (security_invoker = true)
as
select
  t.id as transmission_id,
  t.organization_id,
  t.workflow_id,
  t.certification_id,
  t.preview_id,
  t.connector_kind,
  t.payload_hash,
  t.idempotency_key,
  t.requested_by,
  t.requested_at,
  t.endpoint_host,
  t.request_status,
  t.response_status,
  t.response_body_hash,
  t.response_receipt,
  t.completed_at,
  t.production_destination,
  c.certification_status,
  c.certification_valid,
  (
    t.request_status = 'ACKNOWLEDGED'
    and t.response_status between 200 and 299
    and not t.production_destination
  ) as sandbox_connector_certified
from nonprofit.external_sandbox_transmissions t
join public.nonprofit_submission_preview_certifications_v1 c
  on c.certification_id = t.certification_id;

grant select on public.nonprofit_external_sandbox_transmissions_v1 to authenticated;
revoke all on public.nonprofit_external_sandbox_transmissions_v1 from anon;
