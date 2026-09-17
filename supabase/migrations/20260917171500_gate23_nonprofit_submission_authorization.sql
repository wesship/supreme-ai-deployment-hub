create table if not exists nonprofit.submission_authorizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workflow_id uuid not null,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  request_notes text,
  status text not null default 'PENDING',
  decided_by uuid,
  decided_at timestamptz,
  decision_notes text,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('PENDING','APPROVED','REJECTED','EXPIRED','REVOKED')),
  check ((status = 'PENDING' and decided_by is null and decided_at is null) or status <> 'PENDING')
);

create unique index if not exists submission_authorizations_one_live_per_workflow
on nonprofit.submission_authorizations (workflow_id)
where status in ('PENDING','APPROVED');

alter table nonprofit.submission_authorizations enable row level security;

create policy submission_authorizations_member_read
on nonprofit.submission_authorizations
for select to authenticated
using (
  exists (
    select 1
    from nonprofit_security.memberships m
    where m.organization_id = submission_authorizations.organization_id
      and m.user_id = auth.uid()
      and m.active
  )
);

revoke insert, update, delete on nonprofit.submission_authorizations from authenticated;
grant select on nonprofit.submission_authorizations to authenticated;

create or replace function nonprofit_api.request_submission_authorization(
  p_workflow_id uuid,
  p_notes text default null
)
returns table (
  authorization_id uuid,
  authorization_status text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_ready record;
  v_id uuid := gen_random_uuid();
  v_expires timestamptz := now() + interval '24 hours';
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select r.* into v_ready
  from public.nonprofit_submission_readiness_v1 r
  where r.workflow_id = p_workflow_id;

  if not found then
    raise exception 'WORKFLOW_NOT_FOUND_OR_NOT_VISIBLE' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from nonprofit_security.memberships m
    where m.organization_id = v_ready.organization_id
      and m.user_id = v_user
      and m.active
  ) then
    raise exception 'ACTIVE_MEMBERSHIP_REQUIRED' using errcode = '42501';
  end if;

  if v_ready.submission_status <> 'SUBMISSION_READY' or v_ready.hard_blocker then
    raise exception 'WORKFLOW_NOT_SUBMISSION_READY' using errcode = '42501';
  end if;

  update nonprofit.submission_authorizations
  set status = 'EXPIRED', updated_at = now()
  where workflow_id = p_workflow_id
    and status = 'PENDING'
    and expires_at <= now();

  if exists (
    select 1
    from nonprofit.submission_authorizations a
    where a.workflow_id = p_workflow_id
      and a.status in ('PENDING','APPROVED')
      and a.expires_at > now()
  ) then
    raise exception 'LIVE_SUBMISSION_AUTHORIZATION_EXISTS' using errcode = '55000';
  end if;

  insert into nonprofit.submission_authorizations (
    id, organization_id, workflow_id, requested_by, request_notes, status, expires_at
  ) values (
    v_id, v_ready.organization_id, p_workflow_id, v_user, nullif(btrim(p_notes), ''), 'PENDING', v_expires
  );

  return query select v_id, 'PENDING'::text, v_expires;
end;
$$;

revoke all on function nonprofit_api.request_submission_authorization(uuid,text) from public;
revoke all on function nonprofit_api.request_submission_authorization(uuid,text) from anon;
grant execute on function nonprofit_api.request_submission_authorization(uuid,text) to authenticated;

create or replace function public.nonprofit_request_submission_authorization(
  p_workflow_id uuid,
  p_notes text default null
)
returns table (
  authorization_id uuid,
  authorization_status text,
  expires_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from nonprofit_api.request_submission_authorization(p_workflow_id, p_notes);
$$;

revoke all on function public.nonprofit_request_submission_authorization(uuid,text) from public;
revoke all on function public.nonprofit_request_submission_authorization(uuid,text) from anon;
grant execute on function public.nonprofit_request_submission_authorization(uuid,text) to authenticated;

create or replace function nonprofit_api.decide_submission_authorization(
  p_authorization_id uuid,
  p_decision text,
  p_notes text default null
)
returns table (
  authorization_id uuid,
  authorization_status text,
  decided_at timestamptz,
  audit_event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_aal text := (select auth.jwt() ->> 'aal');
  v_auth nonprofit.submission_authorizations%rowtype;
  v_ready record;
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

  if p_decision not in ('APPROVED','REJECTED') then
    raise exception 'INVALID_DECISION' using errcode = '22023';
  end if;

  select a.* into v_auth
  from nonprofit.submission_authorizations a
  where a.id = p_authorization_id
  for update;

  if not found then
    raise exception 'SUBMISSION_AUTHORIZATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_auth.status <> 'PENDING' then
    raise exception 'SUBMISSION_AUTHORIZATION_NOT_PENDING' using errcode = '55000';
  end if;

  if v_auth.expires_at <= now() then
    update nonprofit.submission_authorizations
    set status = 'EXPIRED', updated_at = now()
    where id = v_auth.id;
    raise exception 'SUBMISSION_AUTHORIZATION_EXPIRED' using errcode = '55000';
  end if;

  if v_auth.requested_by = v_user then
    raise exception 'SEPARATION_OF_DUTIES_REQUIRED' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from nonprofit_security.memberships m
    where m.organization_id = v_auth.organization_id
      and m.user_id = v_user
      and m.active
      and m.can_approve
  ) then
    raise exception 'APPROVER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  select r.* into v_ready
  from public.nonprofit_submission_readiness_v1 r
  where r.workflow_id = v_auth.workflow_id
    and r.organization_id = v_auth.organization_id;

  if not found or v_ready.submission_status <> 'SUBMISSION_READY' or v_ready.hard_blocker then
    raise exception 'READINESS_CHANGED_REAUTHORIZATION_REQUIRED' using errcode = '42501';
  end if;

  update nonprofit.submission_authorizations
  set status = p_decision,
      decided_by = v_user,
      decided_at = v_event_at,
      decision_notes = nullif(btrim(p_notes), ''),
      updated_at = v_event_at
  where id = v_auth.id;

  select ae.event_hash into v_prev_hash
  from nonprofit_security.audit_events ae
  where ae.organization_id = v_auth.organization_id
  order by ae.event_at desc, ae.id desc
  limit 1;

  v_event_hash := encode(extensions.digest(
    concat_ws('|',
      coalesce(v_prev_hash,''),
      v_event_id::text,
      v_auth.organization_id::text,
      v_event_at::text,
      'USER',
      v_user::text,
      'SUBMISSION_AUTHORIZATION_DECISION',
      v_auth.id::text,
      p_decision
    )::bytea,
    'sha256'
  ), 'hex');

  insert into nonprofit_security.audit_events (
    id, organization_id, event_at, actor_type, actor_id, event_type,
    resource_type, resource_id, action, result, previous_event_hash, event_hash
  ) values (
    v_event_id, v_auth.organization_id, v_event_at, 'USER', v_user,
    'SUBMISSION_AUTHORIZATION_DECISION', 'submission_authorization', v_auth.id,
    p_decision, p_decision, v_prev_hash, v_event_hash
  );

  return query select v_auth.id, p_decision, v_event_at, v_event_id;
end;
$$;

revoke all on function nonprofit_api.decide_submission_authorization(uuid,text,text) from public;
revoke all on function nonprofit_api.decide_submission_authorization(uuid,text,text) from anon;
grant execute on function nonprofit_api.decide_submission_authorization(uuid,text,text) to authenticated;

create or replace function public.nonprofit_decide_submission_authorization(
  p_authorization_id uuid,
  p_decision text,
  p_notes text default null
)
returns table (
  authorization_id uuid,
  authorization_status text,
  decided_at timestamptz,
  audit_event_id uuid
)
language sql
security invoker
set search_path = ''
as $$
  select * from nonprofit_api.decide_submission_authorization(p_authorization_id, p_decision, p_notes);
$$;

revoke all on function public.nonprofit_decide_submission_authorization(uuid,text,text) from public;
revoke all on function public.nonprofit_decide_submission_authorization(uuid,text,text) from anon;
grant execute on function public.nonprofit_decide_submission_authorization(uuid,text,text) to authenticated;

create or replace view public.nonprofit_submission_authorizations_v1
with (security_invoker = true)
as
select
  a.id as authorization_id,
  a.organization_id,
  a.workflow_id,
  r.funder_name,
  r.title,
  r.submission_status,
  a.requested_by,
  a.requested_at,
  a.request_notes,
  case
    when a.status = 'PENDING' and a.expires_at <= now() then 'EXPIRED'
    else a.status
  end as authorization_status,
  a.decided_by,
  a.decided_at,
  a.decision_notes,
  a.expires_at,
  (a.requested_by = auth.uid()) as requested_by_current_user,
  (a.status = 'APPROVED' and a.expires_at > now() and r.submission_status = 'SUBMISSION_READY') as authorization_live
from nonprofit.submission_authorizations a
join public.nonprofit_submission_readiness_v1 r
  on r.organization_id = a.organization_id
 and r.workflow_id = a.workflow_id;

grant select on public.nonprofit_submission_authorizations_v1 to authenticated;
revoke all on public.nonprofit_submission_authorizations_v1 from anon;
