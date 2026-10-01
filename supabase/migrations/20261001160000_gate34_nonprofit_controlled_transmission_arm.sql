create table if not exists nonprofit.production_transmission_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  approval_id uuid not null unique references nonprofit.production_irreversible_approvals(id),
  release_certificate_id uuid not null references nonprofit.production_release_certificates(id),
  shadow_run_id uuid not null references nonprofit.production_connector_shadow_runs(id),
  execution_token_id uuid not null unique references nonprofit.production_execution_tokens(id),
  payload_hash text not null,
  endpoint_host text not null,
  idempotency_key text not null unique,
  request_method text not null default 'POST',
  status text not null default 'ARMED',
  armed_by text not null,
  armed_at timestamptz not null default now(),
  network_request_performed boolean not null default false,
  application_payload_transmitted boolean not null default false,
  response_status integer,
  receipt_id text,
  received_payload_hash text,
  receipt_body_hash text,
  receipt_recorded_at timestamptz,
  production_send_available boolean not null default false,
  check (request_method = 'POST'),
  check (status in ('ARMED','RECEIPT_RECORDED','FAILED')),
  check (payload_hash ~ '^[0-9a-f]{64}$'),
  check (production_send_available = false)
);

alter table nonprofit.production_transmission_attempts enable row level security;

create policy production_transmission_attempts_member_read
on nonprofit.production_transmission_attempts for select to authenticated
using (exists (
  select 1 from nonprofit_security.memberships m
  where m.organization_id = production_transmission_attempts.organization_id
    and m.user_id = auth.uid() and m.active
));

revoke insert,update,delete on nonprofit.production_transmission_attempts from authenticated;
grant select on nonprofit.production_transmission_attempts to authenticated;

create or replace function nonprofit_api.arm_production_transmission(
  p_approval_id uuid,
  p_execution_token_id uuid,
  p_plaintext_token text,
  p_expected_payload_hash text,
  p_endpoint_host text,
  p_idempotency_key text,
  p_armed_by text
)
returns table(
  transmission_attempt_id uuid,
  transmission_status text,
  payload_hash text,
  idempotency_key text,
  network_request_performed boolean,
  application_payload_transmitted boolean,
  production_send_available boolean
)
language plpgsql security definer set search_path=''
as $$
declare
  v_approval nonprofit.production_irreversible_approvals%rowtype;
  v_cert nonprofit.production_release_certificates%rowtype;
  v_token nonprofit.production_execution_tokens%rowtype;
  v_attempt_id uuid := gen_random_uuid();
  v_token_status text;
  v_consumed_at timestamptz;
  v_execution_enabled boolean;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;

  select * into v_approval
  from nonprofit.production_irreversible_approvals
  where id=p_approval_id
  for update;
  if not found then raise exception 'IRREVERSIBLE_APPROVAL_NOT_FOUND' using errcode='P0002'; end if;
  if v_approval.status <> 'CLAIMED' or v_approval.claimed_at is null then
    raise exception 'CLAIMED_IRREVERSIBLE_APPROVAL_REQUIRED' using errcode='42501';
  end if;
  if v_approval.expires_at <= now() then
    raise exception 'IRREVERSIBLE_APPROVAL_EXPIRED' using errcode='55000';
  end if;
  if p_expected_payload_hash <> v_approval.payload_hash then
    raise exception 'PAYLOAD_HASH_MISMATCH' using errcode='42501';
  end if;

  select * into v_cert
  from nonprofit.production_release_certificates
  where id=v_approval.release_certificate_id;
  if not found or v_cert.status <> 'CERTIFIED' or v_cert.expires_at <= now() then
    raise exception 'VALID_RELEASE_CERTIFICATE_REQUIRED' using errcode='55000';
  end if;

  if p_endpoint_host is null or length(btrim(p_endpoint_host))=0 then
    raise exception 'PRODUCTION_ENDPOINT_HOST_REQUIRED' using errcode='22023';
  end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) < 24 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode='22023';
  end if;

  select * into v_token
  from nonprofit.production_execution_tokens
  where id=p_execution_token_id
  for update;
  if not found then raise exception 'EXECUTION_TOKEN_NOT_FOUND' using errcode='P0002'; end if;
  if v_token.shadow_run_id <> v_approval.shadow_run_id then
    raise exception 'EXECUTION_TOKEN_SHADOW_MISMATCH' using errcode='42501';
  end if;
  if v_token.request_body_hash <> p_expected_payload_hash then
    raise exception 'EXECUTION_TOKEN_PAYLOAD_HASH_MISMATCH' using errcode='42501';
  end if;

  select c.execution_token_id,c.token_status,c.consumed_at,c.production_execution_enabled
  into p_execution_token_id,v_token_status,v_consumed_at,v_execution_enabled
  from nonprofit_api.consume_production_execution_token(
    p_execution_token_id,
    p_plaintext_token,
    p_expected_payload_hash,
    p_armed_by
  ) c;
  if v_token_status <> 'CONSUMED' or v_execution_enabled then
    raise exception 'EXECUTION_TOKEN_CONSUMPTION_FAILED' using errcode='55000';
  end if;

  insert into nonprofit.production_transmission_attempts(
    id,organization_id,approval_id,release_certificate_id,shadow_run_id,
    execution_token_id,payload_hash,endpoint_host,idempotency_key,request_method,
    status,armed_by,armed_at,network_request_performed,
    application_payload_transmitted,production_send_available
  ) values (
    v_attempt_id,v_approval.organization_id,v_approval.id,v_approval.release_certificate_id,
    v_approval.shadow_run_id,p_execution_token_id,p_expected_payload_hash,
    lower(btrim(p_endpoint_host)),btrim(p_idempotency_key),'POST','ARMED',
    btrim(p_armed_by),now(),false,false,false
  );

  return query select v_attempt_id,'ARMED'::text,p_expected_payload_hash,btrim(p_idempotency_key),false,false,false;
end;
$$;

revoke all on function nonprofit_api.arm_production_transmission(uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function nonprofit_api.arm_production_transmission(uuid,uuid,text,text,text,text,text) to service_role;

create or replace function public.nonprofit_arm_production_transmission(
  p_approval_id uuid,
  p_execution_token_id uuid,
  p_plaintext_token text,
  p_expected_payload_hash text,
  p_endpoint_host text,
  p_idempotency_key text,
  p_armed_by text
)
returns table(
  transmission_attempt_id uuid,
  transmission_status text,
  payload_hash text,
  idempotency_key text,
  network_request_performed boolean,
  application_payload_transmitted boolean,
  production_send_available boolean
)
language sql security invoker set search_path=''
as $$
  select * from nonprofit_api.arm_production_transmission(
    p_approval_id,p_execution_token_id,p_plaintext_token,p_expected_payload_hash,
    p_endpoint_host,p_idempotency_key,p_armed_by
  );
$$;

revoke all on function public.nonprofit_arm_production_transmission(uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.nonprofit_arm_production_transmission(uuid,uuid,text,text,text,text,text) to service_role;

create or replace function nonprofit_api.record_production_transmission_receipt(
  p_transmission_attempt_id uuid,
  p_response_status integer,
  p_receipt_id text,
  p_received_payload_hash text,
  p_receipt_body_hash text,
  p_network_request_performed boolean,
  p_application_payload_transmitted boolean
)
returns table(
  transmission_attempt_id uuid,
  transmission_status text,
  receipt_verified boolean
)
language plpgsql security definer set search_path=''
as $$
declare
  v_attempt nonprofit.production_transmission_attempts%rowtype;
  v_verified boolean;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;

  select * into v_attempt
  from nonprofit.production_transmission_attempts
  where id=p_transmission_attempt_id
  for update;
  if not found then raise exception 'TRANSMISSION_ATTEMPT_NOT_FOUND' using errcode='P0002'; end if;
  if v_attempt.status <> 'ARMED' then raise exception 'TRANSMISSION_ATTEMPT_NOT_ARMED' using errcode='55000'; end if;

  if not p_network_request_performed or not p_application_payload_transmitted then
    raise exception 'AUTHORITATIVE_RECEIPT_REQUIRES_ACTUAL_TRANSMISSION' using errcode='42501';
  end if;
  if p_response_status is null or p_response_status < 200 or p_response_status > 299 then
    raise exception 'SUCCESS_RESPONSE_REQUIRED' using errcode='42501';
  end if;
  if p_receipt_id is null or length(btrim(p_receipt_id))=0 then
    raise exception 'AUTHORITATIVE_RECEIPT_ID_REQUIRED' using errcode='22023';
  end if;
  if p_received_payload_hash is null or p_received_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'RECEIVED_SHA256_REQUIRED' using errcode='22023';
  end if;

  v_verified := p_received_payload_hash = v_attempt.payload_hash;
  if not v_verified then
    update nonprofit.production_transmission_attempts
    set status='FAILED',network_request_performed=true,application_payload_transmitted=true,
        response_status=p_response_status,receipt_id=btrim(p_receipt_id),
        received_payload_hash=p_received_payload_hash,receipt_body_hash=p_receipt_body_hash,
        receipt_recorded_at=now()
    where id=v_attempt.id;
    raise exception 'AUTHORITATIVE_RECEIPT_HASH_MISMATCH' using errcode='XX001';
  end if;

  update nonprofit.production_transmission_attempts
  set status='RECEIPT_RECORDED',network_request_performed=true,application_payload_transmitted=true,
      response_status=p_response_status,receipt_id=btrim(p_receipt_id),
      received_payload_hash=p_received_payload_hash,receipt_body_hash=p_receipt_body_hash,
      receipt_recorded_at=now()
  where id=v_attempt.id;

  return query select v_attempt.id,'RECEIPT_RECORDED'::text,true;
end;
$$;

revoke all on function nonprofit_api.record_production_transmission_receipt(uuid,integer,text,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function nonprofit_api.record_production_transmission_receipt(uuid,integer,text,text,text,boolean,boolean) to service_role;

create or replace function public.nonprofit_record_production_transmission_receipt(
  p_transmission_attempt_id uuid,
  p_response_status integer,
  p_receipt_id text,
  p_received_payload_hash text,
  p_receipt_body_hash text,
  p_network_request_performed boolean,
  p_application_payload_transmitted boolean
)
returns table(transmission_attempt_id uuid,transmission_status text,receipt_verified boolean)
language sql security invoker set search_path=''
as $$
  select * from nonprofit_api.record_production_transmission_receipt(
    p_transmission_attempt_id,p_response_status,p_receipt_id,p_received_payload_hash,
    p_receipt_body_hash,p_network_request_performed,p_application_payload_transmitted
  );
$$;

revoke all on function public.nonprofit_record_production_transmission_receipt(uuid,integer,text,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.nonprofit_record_production_transmission_receipt(uuid,integer,text,text,text,boolean,boolean) to service_role;

create or replace view public.nonprofit_production_transmission_attempts_v1
with (security_invoker=true)
as
select
  a.*,
  (a.status='RECEIPT_RECORDED' and a.received_payload_hash=a.payload_hash and a.response_status between 200 and 299) as authoritative_receipt_verified,
  false as production_send_available_effective
from nonprofit.production_transmission_attempts a;

grant select on public.nonprofit_production_transmission_attempts_v1 to authenticated;
revoke all on public.nonprofit_production_transmission_attempts_v1 from anon;