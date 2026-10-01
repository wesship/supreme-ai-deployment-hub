create table if not exists nonprofit.production_irreversible_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  release_certificate_id uuid not null references nonprofit.production_release_certificates(id),
  shadow_run_id uuid not null,
  subject_ref text not null,
  payload_hash text not null,
  approved_by uuid not null,
  approved_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  claimed_at timestamptz,
  status text not null default 'AUTHORIZED',
  production_send_available boolean not null default false,
  check (status in ('AUTHORIZED','CLAIMED','EXPIRED','REVOKED')),
  check (production_send_available = false)
);

create unique index if not exists production_irreversible_approvals_one_live
on nonprofit.production_irreversible_approvals(release_certificate_id,payload_hash)
where status in ('AUTHORIZED','CLAIMED');

alter table nonprofit.production_irreversible_approvals enable row level security;
create policy production_irreversible_approvals_member_read
on nonprofit.production_irreversible_approvals for select to authenticated
using (exists (
  select 1 from nonprofit_security.memberships m
  where m.organization_id=production_irreversible_approvals.organization_id
    and m.user_id=auth.uid() and m.active
));
revoke insert,update,delete on nonprofit.production_irreversible_approvals from authenticated;
grant select on nonprofit.production_irreversible_approvals to authenticated;

create or replace function nonprofit_api.authorize_irreversible_production_action(
  p_release_certificate_id uuid,
  p_payload_hash text,
  p_confirmation_phrase text
)
returns table(approval_id uuid,status text,expires_at timestamptz,payload_hash text,production_send_available boolean)
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_aal text := coalesce((select auth.jwt()->>'aal'),'');
  v_cert nonprofit.production_release_certificates%rowtype;
  v_run nonprofit.production_release_certification_runs%rowtype;
  v_id uuid := gen_random_uuid();
  v_expires timestamptz := now()+interval '10 minutes';
  v_phrase constant text := 'AUTHORIZE IRREVERSIBLE PRODUCTION SUBMISSION';
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if v_aal <> 'aal2' then raise exception 'AAL2_MFA_REQUIRED' using errcode='42501'; end if;
  if p_confirmation_phrase is distinct from v_phrase then raise exception 'EXACT_IRREVERSIBLE_CONFIRMATION_REQUIRED' using errcode='22023'; end if;
  if p_payload_hash is null or p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'SHA256_PAYLOAD_HASH_REQUIRED' using errcode='22023'; end if;

  select * into v_cert from nonprofit.production_release_certificates where id=p_release_certificate_id;
  if not found or v_cert.status<>'CERTIFIED' or v_cert.expires_at<=now() then raise exception 'VALID_RELEASE_CERTIFICATE_REQUIRED' using errcode='55000'; end if;
  select * into v_run from nonprofit.production_release_certification_runs where id=v_cert.release_run_id and decision='GO';
  if not found then raise exception 'GO_RELEASE_RUN_REQUIRED' using errcode='55000'; end if;
  if not exists(select 1 from nonprofit_security.memberships m where m.organization_id=v_cert.organization_id and m.user_id=v_user and m.active and m.can_approve) then raise exception 'FINAL_APPROVER_REQUIRED' using errcode='42501'; end if;

  update nonprofit.production_irreversible_approvals set status='EXPIRED'
  where release_certificate_id=v_cert.id and status='AUTHORIZED' and expires_at<=now();
  if exists(select 1 from nonprofit.production_irreversible_approvals a where a.release_certificate_id=v_cert.id and a.payload_hash=p_payload_hash and a.status in ('AUTHORIZED','CLAIMED')) then raise exception 'LIVE_APPROVAL_ALREADY_EXISTS' using errcode='55000'; end if;

  insert into nonprofit.production_irreversible_approvals(
    id,organization_id,release_certificate_id,shadow_run_id,subject_ref,payload_hash,approved_by,approved_at,expires_at,status,production_send_available
  ) values(v_id,v_cert.organization_id,v_cert.id,v_run.shadow_run_id,v_cert.subject_ref,p_payload_hash,v_user,now(),v_expires,'AUTHORIZED',false);

  return query select v_id,'AUTHORIZED'::text,v_expires,p_payload_hash,false;
end; $$;

revoke all on function nonprofit_api.authorize_irreversible_production_action(uuid,text,text) from public,anon;
grant execute on function nonprofit_api.authorize_irreversible_production_action(uuid,text,text) to authenticated;
create or replace function public.nonprofit_authorize_irreversible_production_action(p_release_certificate_id uuid,p_payload_hash text,p_confirmation_phrase text)
returns table(approval_id uuid,status text,expires_at timestamptz,payload_hash text,production_send_available boolean)
language sql security invoker set search_path=''
as $$ select * from nonprofit_api.authorize_irreversible_production_action(p_release_certificate_id,p_payload_hash,p_confirmation_phrase); $$;
revoke all on function public.nonprofit_authorize_irreversible_production_action(uuid,text,text) from public,anon;
grant execute on function public.nonprofit_authorize_irreversible_production_action(uuid,text,text) to authenticated;

create or replace function nonprofit_api.claim_irreversible_production_action(p_approval_id uuid,p_expected_payload_hash text)
returns table(approval_id uuid,status text,shadow_run_id uuid,payload_hash text,production_send_available boolean)
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_aal text := coalesce((select auth.jwt()->>'aal'),'');
  v nonprofit.production_irreversible_approvals%rowtype;
  v_cert nonprofit.production_release_certificates%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if v_aal <> 'aal2' then raise exception 'AAL2_MFA_REQUIRED' using errcode='42501'; end if;
  select * into v from nonprofit.production_irreversible_approvals where id=p_approval_id for update;
  if not found then raise exception 'APPROVAL_NOT_FOUND' using errcode='P0002'; end if;
  if v.approved_by<>v_user then raise exception 'ORIGINAL_APPROVER_REQUIRED' using errcode='42501'; end if;
  if v.status<>'AUTHORIZED' or v.expires_at<=now() then raise exception 'LIVE_APPROVAL_REQUIRED' using errcode='55000'; end if;
  if p_expected_payload_hash<>v.payload_hash then raise exception 'PAYLOAD_HASH_MISMATCH' using errcode='22023'; end if;
  select * into v_cert from nonprofit.production_release_certificates where id=v.release_certificate_id;
  if not found or v_cert.status<>'CERTIFIED' or v_cert.expires_at<=now() then raise exception 'RELEASE_CERTIFICATE_EXPIRED' using errcode='55000'; end if;
  update nonprofit.production_irreversible_approvals set status='CLAIMED',claimed_at=now() where id=v.id;
  return query select v.id,'CLAIMED'::text,v.shadow_run_id,v.payload_hash,false;
end; $$;

revoke all on function nonprofit_api.claim_irreversible_production_action(uuid,text) from public,anon;
grant execute on function nonprofit_api.claim_irreversible_production_action(uuid,text) to authenticated;
create or replace function public.nonprofit_claim_irreversible_production_action(p_approval_id uuid,p_expected_payload_hash text)
returns table(approval_id uuid,status text,shadow_run_id uuid,payload_hash text,production_send_available boolean)
language sql security invoker set search_path=''
as $$ select * from nonprofit_api.claim_irreversible_production_action(p_approval_id,p_expected_payload_hash); $$;
revoke all on function public.nonprofit_claim_irreversible_production_action(uuid,text) from public,anon;
grant execute on function public.nonprofit_claim_irreversible_production_action(uuid,text) to authenticated;

create or replace view public.nonprofit_production_irreversible_approvals_v1 with (security_invoker=true) as
select id as approval_id,organization_id,release_certificate_id,shadow_run_id,subject_ref,payload_hash,approved_by,approved_at,expires_at,claimed_at,status,
  (status='AUTHORIZED' and expires_at>now()) as approval_live,
  false::boolean as production_send_available
from nonprofit.production_irreversible_approvals;
grant select on public.nonprofit_production_irreversible_approvals_v1 to authenticated;
revoke all on public.nonprofit_production_irreversible_approvals_v1 from anon;