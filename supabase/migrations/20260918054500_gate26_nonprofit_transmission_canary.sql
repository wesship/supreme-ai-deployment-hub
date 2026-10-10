create table if not exists nonprofit.submission_canary_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workflow_id uuid not null,
  certification_id uuid not null references nonprofit.submission_preview_certifications(id),
  preview_id uuid not null references nonprofit.submission_previews(id),
  connector_kind text not null,
  destination_kind text not null default 'INTERNAL_SANDBOX_CANARY',
  frozen_payload jsonb not null,
  certified_payload_hash text not null,
  dispatched_by uuid not null,
  dispatched_at timestamptz not null default now(),
  status text not null default 'CANARY_DISPATCHED',
  external_network_performed boolean not null default false,
  production_destination boolean not null default false,
  created_at timestamptz not null default now(),
  check (destination_kind = 'INTERNAL_SANDBOX_CANARY'),
  check (status = 'CANARY_DISPATCHED'),
  check (external_network_performed = false),
  check (production_destination = false)
);

create unique index if not exists submission_canary_outbox_one_per_certification
on nonprofit.submission_canary_outbox(certification_id);

create table if not exists nonprofit.submission_canary_receipts (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null unique references nonprofit.submission_canary_outbox(id),
  organization_id uuid not null,
  workflow_id uuid not null,
  certification_id uuid not null,
  received_payload_hash text not null,
  hash_verified boolean not null,
  receipt_status text not null,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (receipt_status in ('HASH_VERIFIED','HASH_MISMATCH'))
);

alter table nonprofit.submission_canary_outbox enable row level security;
alter table nonprofit.submission_canary_receipts enable row level security;

create policy submission_canary_outbox_member_read
on nonprofit.submission_canary_outbox
for select to authenticated
using (
  exists (
    select 1
    from nonprofit_security.memberships m
    where m.organization_id = submission_canary_outbox.organization_id
      and m.user_id = auth.uid()
      and m.active
  )
);

create policy submission_canary_receipts_member_read
on nonprofit.submission_canary_receipts
for select to authenticated
using (
  exists (
    select 1
    from nonprofit_security.memberships m
    where m.organization_id = submission_canary_receipts.organization_id
      and m.user_id = auth.uid()
      and m.active
  )
);

revoke insert, update, delete on nonprofit.submission_canary_outbox from authenticated;
revoke insert, update, delete on nonprofit.submission_canary_receipts from authenticated;
grant select on nonprofit.submission_canary_outbox to authenticated;
grant select on nonprofit.submission_canary_receipts to authenticated;

create or replace function nonprofit_api.run_submission_canary(
  p_certification_id uuid
)
returns table (
  canary_outbox_id uuid,
  canary_receipt_id uuid,
  canary_status text,
  certified_payload_hash text,
  received_payload_hash text,
  hash_verified boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_aal text := (select auth.jwt() ->> 'aal');
  v_cert record;
  v_outbox_id uuid := gen_random_uuid();
  v_receipt_id uuid := gen_random_uuid();
  v_received_hash text;
  v_hash_verified boolean;
  v_event_id uuid := gen_random_uuid();
  v_event_at timestamptz := now();
  v_prev_hash text;
  v_event_hash text;
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
    select 1
    from nonprofit_security.memberships m
    where m.organization_id = v_cert.organization_id
      and m.user_id = v_user
      and m.active
      and m.can_approve
  ) then
    raise exception 'CANARY_EXECUTOR_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if v_cert.certified_by = v_user then
    raise exception 'SEPARATION_OF_DUTIES_REQUIRED' using errcode = '42501';
  end if;

  if exists (
    select 1
    from nonprofit.submission_canary_outbox o
    where o.certification_id = p_certification_id
  ) then
    raise exception 'CANARY_ALREADY_RUN_FOR_CERTIFICATION' using errcode = '55000';
  end if;

  if v_cert.certified_payload_hash <> v_cert.current_payload_hash
     or not v_cert.hash_still_matches
     or not v_cert.package_unchanged then
    raise exception 'CERTIFIED_HASH_NO_LONGER_CURRENT' using errcode = '42501';
  end if;

  insert into nonprofit.submission_canary_outbox (
    id,
    organization_id,
    workflow_id,
    certification_id,
    preview_id,
    connector_kind,
    destination_kind,
    frozen_payload,
    certified_payload_hash,
    dispatched_by,
    dispatched_at,
    status,
    external_network_performed,
    production_destination
  ) values (
    v_outbox_id,
    v_cert.organization_id,
    v_cert.workflow_id,
    v_cert.certification_id,
    v_cert.preview_id,
    v_cert.connector_kind,
    'INTERNAL_SANDBOX_CANARY',
    v_cert.frozen_payload,
    v_cert.certified_payload_hash,
    v_user,
    v_event_at,
    'CANARY_DISPATCHED',
    false,
    false
  );

  v_received_hash := encode(
    extensions.digest(convert_to(v_cert.frozen_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  v_hash_verified := (v_received_hash = v_cert.certified_payload_hash);

  insert into nonprofit.submission_canary_receipts (
    id,
    outbox_id,
    organization_id,
    workflow_id,
    certification_id,
    received_payload_hash,
    hash_verified,
    receipt_status,
    received_at
  ) values (
    v_receipt_id,
    v_outbox_id,
    v_cert.organization_id,
    v_cert.workflow_id,
    v_cert.certification_id,
    v_received_hash,
    v_hash_verified,
    case when v_hash_verified then 'HASH_VERIFIED' else 'HASH_MISMATCH' end,
    v_event_at
  );

  if not v_hash_verified then
    raise exception 'CANARY_HASH_MISMATCH' using errcode = 'XX001';
  end if;

  select ae.event_hash into v_prev_hash
  from nonprofit_security.audit_events ae
  where ae.organization_id = v_cert.organization_id
  order by ae.event_at desc, ae.id desc
  limit 1;

  v_event_hash := encode(extensions.digest(
    concat_ws('|',
      coalesce(v_prev_hash,''),
      v_event_id::text,
      v_cert.organization_id::text,
      v_event_at::text,
      'USER',
      v_user::text,
      'SUBMISSION_CANARY_HASH_VERIFIED',
      v_outbox_id::text,
      v_cert.certified_payload_hash,
      v_received_hash
    )::bytea,
    'sha256'
  ), 'hex');

  insert into nonprofit_security.audit_events (
    id, organization_id, event_at, actor_type, actor_id, event_type,
    resource_type, resource_id, action, result, previous_event_hash, event_hash
  ) values (
    v_event_id, v_cert.organization_id, v_event_at, 'USER', v_user,
    'SUBMISSION_CANARY_HASH_VERIFIED', 'submission_canary_outbox', v_outbox_id,
    'INTERNAL_SANDBOX_CANARY', v_received_hash, v_prev_hash, v_event_hash
  );

  return query
  select
    v_outbox_id,
    v_receipt_id,
    'HASH_VERIFIED'::text,
    v_cert.certified_payload_hash,
    v_received_hash,
    v_hash_verified;
end;
$$;

revoke all on function nonprofit_api.run_submission_canary(uuid) from public;
revoke all on function nonprofit_api.run_submission_canary(uuid) from anon;
grant execute on function nonprofit_api.run_submission_canary(uuid) to authenticated;

create or replace function public.nonprofit_run_submission_canary(
  p_certification_id uuid
)
returns table (
  canary_outbox_id uuid,
  canary_receipt_id uuid,
  canary_status text,
  certified_payload_hash text,
  received_payload_hash text,
  hash_verified boolean
)
language sql
security invoker
set search_path = ''
as $$
  select * from nonprofit_api.run_submission_canary(p_certification_id);
$$;

revoke all on function public.nonprofit_run_submission_canary(uuid) from public;
revoke all on function public.nonprofit_run_submission_canary(uuid) from anon;
grant execute on function public.nonprofit_run_submission_canary(uuid) to authenticated;

create or replace view public.nonprofit_submission_canaries_v1
with (security_invoker = true)
as
select
  o.id as canary_outbox_id,
  r.id as canary_receipt_id,
  o.organization_id,
  o.workflow_id,
  o.certification_id,
  o.preview_id,
  o.connector_kind,
  o.destination_kind,
  o.certified_payload_hash,
  r.received_payload_hash,
  r.hash_verified,
  r.receipt_status,
  o.dispatched_by,
  o.dispatched_at,
  r.received_at,
  o.external_network_performed,
  o.production_destination,
  c.certification_status,
  c.certification_valid,
  (
    r.hash_verified
    and r.receipt_status = 'HASH_VERIFIED'
    and o.external_network_performed = false
    and o.production_destination = false
  ) as canary_passed
from nonprofit.submission_canary_outbox o
join nonprofit.submission_canary_receipts r on r.outbox_id = o.id
join public.nonprofit_submission_preview_certifications_v1 c
  on c.certification_id = o.certification_id;

grant select on public.nonprofit_submission_canaries_v1 to authenticated;
revoke all on public.nonprofit_submission_canaries_v1 from anon;
