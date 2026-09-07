create table if not exists nonprofit_security.membership_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references nonprofit.organizations(id) on delete cascade,
  email_hash text not null,
  role nonprofit_security.member_role not null,
  can_approve boolean not null default false,
  token_hash text not null unique,
  status text not null default 'PENDING' check (status in ('PENDING','CLAIMED','REVOKED','EXPIRED')),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_by uuid null references auth.users(id) on delete set null,
  claimed_at timestamptz null,
  revoked_at timestamptz null
);

create index if not exists membership_invites_org_status_idx
  on nonprofit_security.membership_invites(organization_id, status, expires_at);
create index if not exists membership_invites_email_hash_idx
  on nonprofit_security.membership_invites(email_hash);

alter table nonprofit_security.membership_invites enable row level security;
revoke all on nonprofit_security.membership_invites from public, anon, authenticated;

create or replace function nonprofit_api.create_membership_invite(
  p_organization_id uuid,
  p_email text,
  p_role nonprofit_security.member_role,
  p_can_approve boolean default false,
  p_expires_hours integer default 72
)
returns table(invite_id uuid, invite_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_aal text := (select auth.jwt() ->> 'aal');
  v_email text := lower(btrim(p_email));
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_email_hash text;
  v_token_hash text;
  v_invite_id uuid := gen_random_uuid();
  v_expires timestamptz;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if v_aal is distinct from 'aal2' then raise exception 'MFA_AAL2_REQUIRED' using errcode='42501'; end if;
  if v_email is null or v_email = '' or position('@' in v_email) < 2 then raise exception 'VALID_EMAIL_REQUIRED' using errcode='22023'; end if;
  if p_expires_hours < 1 or p_expires_hours > 168 then raise exception 'INVALID_EXPIRY' using errcode='22023'; end if;

  if not exists (
    select 1 from nonprofit_security.memberships m
    where m.organization_id = p_organization_id
      and m.user_id = v_user and m.active
      and m.role in ('BOARD'::nonprofit_security.member_role,'EXECUTIVE'::nonprofit_security.member_role)
  ) then raise exception 'GOVERNANCE_ROLE_REQUIRED' using errcode='42501'; end if;

  v_email_hash := encode(extensions.digest(v_email::bytea,'sha256'),'hex');
  v_token_hash := encode(extensions.digest(v_token::bytea,'sha256'),'hex');
  v_expires := now() + make_interval(hours => p_expires_hours);

  update nonprofit_security.membership_invites
  set status='EXPIRED'
  where organization_id=p_organization_id and email_hash=v_email_hash and role=p_role
    and status='PENDING' and expires_at <= now();

  insert into nonprofit_security.membership_invites(
    id, organization_id, email_hash, role, can_approve, token_hash, created_by, expires_at
  ) values (
    v_invite_id, p_organization_id, v_email_hash, p_role, p_can_approve, v_token_hash, v_user, v_expires
  );

  return query select v_invite_id, v_token, v_expires;
end;
$$;

revoke all on function nonprofit_api.create_membership_invite(uuid,text,nonprofit_security.member_role,boolean,integer) from public, anon;
grant execute on function nonprofit_api.create_membership_invite(uuid,text,nonprofit_security.member_role,boolean,integer) to authenticated;

create or replace function nonprofit_api.claim_membership_invite(p_token text)
returns table(
  membership_id uuid,
  organization_id uuid,
  role nonprofit_security.member_role,
  can_approve boolean,
  audit_event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_aal text := (select auth.jwt() ->> 'aal');
  v_email text;
  v_email_hash text;
  v_token_hash text;
  v_invite nonprofit_security.membership_invites%rowtype;
  v_membership_id uuid;
  v_prev_hash text;
  v_event_id uuid := gen_random_uuid();
  v_event_at timestamptz := now();
  v_event_hash text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_token is null or length(btrim(p_token)) < 32 then raise exception 'INVALID_INVITE_TOKEN' using errcode='22023'; end if;

  select lower(btrim(u.email)) into v_email from auth.users u where u.id=v_user;
  if v_email is null or v_email='' then raise exception 'VERIFIED_EMAIL_REQUIRED' using errcode='42501'; end if;

  v_email_hash := encode(extensions.digest(v_email::bytea,'sha256'),'hex');
  v_token_hash := encode(extensions.digest(btrim(p_token)::bytea,'sha256'),'hex');

  select i.* into v_invite
  from nonprofit_security.membership_invites i
  where i.token_hash=v_token_hash
  for update;

  if not found then raise exception 'INVITE_NOT_FOUND' using errcode='P0002'; end if;
  if v_invite.status <> 'PENDING' then raise exception 'INVITE_NOT_PENDING' using errcode='55000'; end if;
  if v_invite.expires_at <= now() then
    update nonprofit_security.membership_invites set status='EXPIRED' where id=v_invite.id;
    raise exception 'INVITE_EXPIRED' using errcode='55000';
  end if;
  if v_invite.email_hash <> v_email_hash then raise exception 'INVITE_EMAIL_MISMATCH' using errcode='42501'; end if;

  if v_invite.role in (
    'BOARD'::nonprofit_security.member_role,
    'EXECUTIVE'::nonprofit_security.member_role,
    'FINANCE'::nonprofit_security.member_role,
    'COMPLIANCE'::nonprofit_security.member_role
  ) and v_aal is distinct from 'aal2' then
    raise exception 'MFA_AAL2_REQUIRED_FOR_HIGH_AUTHORITY_ROLE' using errcode='42501';
  end if;

  insert into nonprofit_security.memberships(organization_id,user_id,role,active,can_approve)
  values(v_invite.organization_id,v_user,v_invite.role,true,v_invite.can_approve)
  on conflict (organization_id,user_id,role)
  do update set active=true, can_approve=excluded.can_approve
  returning id into v_membership_id;

  update nonprofit_security.membership_invites
  set status='CLAIMED', claimed_by=v_user, claimed_at=v_event_at
  where id=v_invite.id;

  select ae.event_hash into v_prev_hash
  from nonprofit_security.audit_events ae
  where ae.organization_id=v_invite.organization_id
  order by ae.event_at desc, ae.id desc limit 1;

  v_event_hash := encode(extensions.digest(
    concat_ws('|',coalesce(v_prev_hash,''),v_event_id::text,v_invite.organization_id::text,
      v_event_at::text,'USER',v_user::text,'MEMBERSHIP_INVITE_CLAIM',v_membership_id::text,
      v_invite.role::text)::bytea,'sha256'),'hex');

  insert into nonprofit_security.audit_events(
    id,organization_id,event_at,actor_type,actor_id,event_type,resource_type,resource_id,
    action,result,previous_event_hash,event_hash
  ) values(
    v_event_id,v_invite.organization_id,v_event_at,'USER',v_user,'MEMBERSHIP_INVITE_CLAIM',
    'membership',v_membership_id,'CLAIM_MEMBERSHIP_INVITE',v_invite.role::text,v_prev_hash,v_event_hash
  );

  return query select v_membership_id,v_invite.organization_id,v_invite.role,v_invite.can_approve,v_event_id;
end;
$$;

revoke all on function nonprofit_api.claim_membership_invite(text) from public, anon;
grant execute on function nonprofit_api.claim_membership_invite(text) to authenticated;

create or replace function public.nonprofit_create_membership_invite(
  p_organization_id uuid,
  p_email text,
  p_role nonprofit_security.member_role,
  p_can_approve boolean default false,
  p_expires_hours integer default 72
)
returns table(invite_id uuid, invite_token text, expires_at timestamptz)
language sql
security invoker
set search_path=''
as $$
  select * from nonprofit_api.create_membership_invite(p_organization_id,p_email,p_role,p_can_approve,p_expires_hours);
$$;

revoke all on function public.nonprofit_create_membership_invite(uuid,text,nonprofit_security.member_role,boolean,integer) from public, anon;
grant execute on function public.nonprofit_create_membership_invite(uuid,text,nonprofit_security.member_role,boolean,integer) to authenticated;

create or replace function public.nonprofit_claim_membership_invite(p_token text)
returns table(
  membership_id uuid,
  organization_id uuid,
  role nonprofit_security.member_role,
  can_approve boolean,
  audit_event_id uuid
)
language sql
security invoker
set search_path=''
as $$
  select * from nonprofit_api.claim_membership_invite(p_token);
$$;

revoke all on function public.nonprofit_claim_membership_invite(text) from public, anon;
grant execute on function public.nonprofit_claim_membership_invite(text) to authenticated;

create or replace view public.nonprofit_my_memberships_v1
with (security_invoker=true)
as
select
  m.id as membership_id,
  m.organization_id,
  o.legal_name,
  o.display_name,
  m.role,
  m.active,
  m.can_approve,
  m.created_at
from nonprofit_security.memberships m
join nonprofit.organizations o on o.id=m.organization_id
where m.user_id=(select auth.uid());

revoke all on public.nonprofit_my_memberships_v1 from public, anon;
grant select on public.nonprofit_my_memberships_v1 to authenticated;