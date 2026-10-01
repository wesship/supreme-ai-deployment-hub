create table if not exists nonprofit.production_connector_reconciliations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  transmission_attempt_id uuid not null unique references nonprofit.production_transmission_attempts(id),
  idempotency_key text not null,
  endpoint_host text not null,
  payload_hash text not null,
  connector_state text not null default 'READY_FOR_PROTECTED_CONNECTOR',
  dispatch_started_at timestamptz,
  dispatch_completed_at timestamptz,
  remote_confirmation_id text,
  remote_payload_hash text,
  remote_response_status integer,
  reconciliation_status text not null default 'PENDING',
  retry_disposition text not null default 'NO_RETRY',
  ambiguous_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (connector_state in ('READY_FOR_PROTECTED_CONNECTOR','DISPATCHING','OBSERVED_RESULT','CLOSED')),
  check (reconciliation_status in ('PENDING','ACKNOWLEDGED','DUPLICATE_CONFIRMED','AMBIGUOUS_HOLD','FAILED_SAFE')),
  check (retry_disposition in ('NO_RETRY','MANUAL_REVIEW_REQUIRED','SAFE_TO_RETRY_WITH_SAME_IDEMPOTENCY_KEY')),
  check (payload_hash ~ '^[0-9a-f]{64}$')
);

alter table nonprofit.production_connector_reconciliations enable row level security;

create policy production_connector_reconciliations_member_read
on nonprofit.production_connector_reconciliations for select to authenticated
using (exists (
  select 1 from nonprofit_security.memberships m
  where m.organization_id=production_connector_reconciliations.organization_id
    and m.user_id=auth.uid() and m.active
));

revoke insert,update,delete on nonprofit.production_connector_reconciliations from authenticated;
grant select on nonprofit.production_connector_reconciliations to authenticated;

create or replace function nonprofit_api.open_protected_connector_dispatch(
  p_transmission_attempt_id uuid,
  p_connector_actor text
)
returns table(
  reconciliation_id uuid,
  connector_state text,
  idempotency_key text,
  endpoint_host text,
  payload_hash text,
  retry_disposition text
)
language plpgsql security definer set search_path=''
as $$
declare
  v_attempt nonprofit.production_transmission_attempts%rowtype;
  v_existing nonprofit.production_connector_reconciliations%rowtype;
  v_id uuid := gen_random_uuid();
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;

  select * into v_attempt
  from nonprofit.production_transmission_attempts
  where id=p_transmission_attempt_id
  for update;
  if not found then raise exception 'TRANSMISSION_ATTEMPT_NOT_FOUND' using errcode='P0002'; end if;
  if v_attempt.status <> 'ARMED' then raise exception 'ARMED_TRANSMISSION_REQUIRED' using errcode='55000'; end if;
  if v_attempt.network_request_performed or v_attempt.application_payload_transmitted then
    raise exception 'TRANSMISSION_ALREADY_OBSERVED' using errcode='55000';
  end if;

  select * into v_existing
  from nonprofit.production_connector_reconciliations
  where transmission_attempt_id=v_attempt.id;
  if found then
    if v_existing.connector_state in ('DISPATCHING','OBSERVED_RESULT','CLOSED') then
      raise exception 'CONNECTOR_DISPATCH_ALREADY_OPENED_NO_BLIND_RETRY' using errcode='55000';
    end if;
    return query select v_existing.id,v_existing.connector_state,v_existing.idempotency_key,v_existing.endpoint_host,v_existing.payload_hash,v_existing.retry_disposition;
    return;
  end if;

  insert into nonprofit.production_connector_reconciliations(
    id,organization_id,transmission_attempt_id,idempotency_key,endpoint_host,payload_hash,
    connector_state,dispatch_started_at,reconciliation_status,retry_disposition
  ) values (
    v_id,v_attempt.organization_id,v_attempt.id,v_attempt.idempotency_key,v_attempt.endpoint_host,
    v_attempt.payload_hash,'DISPATCHING',now(),'PENDING','NO_RETRY'
  );

  return query select v_id,'DISPATCHING'::text,v_attempt.idempotency_key,v_attempt.endpoint_host,v_attempt.payload_hash,'NO_RETRY'::text;
end;
$$;

revoke all on function nonprofit_api.open_protected_connector_dispatch(uuid,text) from public,anon,authenticated;
grant execute on function nonprofit_api.open_protected_connector_dispatch(uuid,text) to service_role;

create or replace function public.nonprofit_open_protected_connector_dispatch(
  p_transmission_attempt_id uuid,
  p_connector_actor text
)
returns table(reconciliation_id uuid,connector_state text,idempotency_key text,endpoint_host text,payload_hash text,retry_disposition text)
language sql security invoker set search_path=''
as $$
  select * from nonprofit_api.open_protected_connector_dispatch(p_transmission_attempt_id,p_connector_actor);
$$;

revoke all on function public.nonprofit_open_protected_connector_dispatch(uuid,text) from public,anon,authenticated;
grant execute on function public.nonprofit_open_protected_connector_dispatch(uuid,text) to service_role;

create or replace function nonprofit_api.reconcile_protected_connector_result(
  p_reconciliation_id uuid,
  p_network_request_performed boolean,
  p_application_payload_transmitted boolean,
  p_response_status integer,
  p_remote_confirmation_id text,
  p_remote_payload_hash text,
  p_duplicate_confirmed boolean default false,
  p_ambiguous_reason text default null
)
returns table(
  reconciliation_id uuid,
  reconciliation_status text,
  retry_disposition text,
  authoritative_receipt_verified boolean
)
language plpgsql security definer set search_path=''
as $$
declare
  v_rec nonprofit.production_connector_reconciliations%rowtype;
  v_status text;
  v_retry text;
  v_verified boolean := false;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;

  select * into v_rec
  from nonprofit.production_connector_reconciliations
  where id=p_reconciliation_id
  for update;
  if not found then raise exception 'RECONCILIATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_rec.connector_state <> 'DISPATCHING' then raise exception 'DISPATCHING_RECONCILIATION_REQUIRED' using errcode='55000'; end if;

  if not p_network_request_performed then
    v_status := 'FAILED_SAFE';
    v_retry := 'SAFE_TO_RETRY_WITH_SAME_IDEMPOTENCY_KEY';
  elsif p_network_request_performed and not p_application_payload_transmitted then
    v_status := 'AMBIGUOUS_HOLD';
    v_retry := 'MANUAL_REVIEW_REQUIRED';
  elsif p_duplicate_confirmed then
    if p_remote_confirmation_id is null or length(btrim(p_remote_confirmation_id))=0 then
      raise exception 'DUPLICATE_CONFIRMATION_ID_REQUIRED' using errcode='22023';
    end if;
    v_status := 'DUPLICATE_CONFIRMED';
    v_retry := 'NO_RETRY';
  elsif p_response_status between 200 and 299
    and p_remote_confirmation_id is not null
    and length(btrim(p_remote_confirmation_id))>0
    and p_remote_payload_hash=v_rec.payload_hash then
    perform nonprofit_api.record_production_transmission_receipt(
      v_rec.transmission_attempt_id,p_response_status,p_remote_confirmation_id,
      p_remote_payload_hash,null,true,true
    );
    v_status := 'ACKNOWLEDGED';
    v_retry := 'NO_RETRY';
    v_verified := true;
  else
    v_status := 'AMBIGUOUS_HOLD';
    v_retry := 'MANUAL_REVIEW_REQUIRED';
  end if;

  update nonprofit.production_connector_reconciliations
  set connector_state='CLOSED',
      dispatch_completed_at=now(),
      remote_confirmation_id=nullif(btrim(p_remote_confirmation_id),''),
      remote_payload_hash=p_remote_payload_hash,
      remote_response_status=p_response_status,
      reconciliation_status=v_status,
      retry_disposition=v_retry,
      ambiguous_reason=case when v_status='AMBIGUOUS_HOLD' then coalesce(nullif(btrim(p_ambiguous_reason),''),'REMOTE_OUTCOME_UNCERTAIN') else null end,
      updated_at=now()
  where id=v_rec.id;

  return query select v_rec.id,v_status,v_retry,v_verified;
end;
$$;

revoke all on function nonprofit_api.reconcile_protected_connector_result(uuid,boolean,boolean,integer,text,text,boolean,text) from public,anon,authenticated;
grant execute on function nonprofit_api.reconcile_protected_connector_result(uuid,boolean,boolean,integer,text,text,boolean,text) to service_role;

create or replace function public.nonprofit_reconcile_protected_connector_result(
  p_reconciliation_id uuid,
  p_network_request_performed boolean,
  p_application_payload_transmitted boolean,
  p_response_status integer,
  p_remote_confirmation_id text,
  p_remote_payload_hash text,
  p_duplicate_confirmed boolean default false,
  p_ambiguous_reason text default null
)
returns table(reconciliation_id uuid,reconciliation_status text,retry_disposition text,authoritative_receipt_verified boolean)
language sql security invoker set search_path=''
as $$
  select * from nonprofit_api.reconcile_protected_connector_result(
    p_reconciliation_id,p_network_request_performed,p_application_payload_transmitted,
    p_response_status,p_remote_confirmation_id,p_remote_payload_hash,p_duplicate_confirmed,p_ambiguous_reason
  );
$$;

revoke all on function public.nonprofit_reconcile_protected_connector_result(uuid,boolean,boolean,integer,text,text,boolean,text) from public,anon,authenticated;
grant execute on function public.nonprofit_reconcile_protected_connector_result(uuid,boolean,boolean,integer,text,text,boolean,text) to service_role;

create or replace view public.nonprofit_production_connector_reconciliations_v1
with (security_invoker=true)
as
select
  r.*,
  a.status as transmission_attempt_status,
  a.receipt_id as authoritative_receipt_id,
  (a.status='RECEIPT_RECORDED' and a.received_payload_hash=a.payload_hash) as authoritative_receipt_verified,
  (r.reconciliation_status='AMBIGUOUS_HOLD') as manual_review_required,
  false as automatic_retry_allowed
from nonprofit.production_connector_reconciliations r
join nonprofit.production_transmission_attempts a on a.id=r.transmission_attempt_id;

grant select on public.nonprofit_production_connector_reconciliations_v1 to authenticated;
revoke all on public.nonprofit_production_connector_reconciliations_v1 from anon;