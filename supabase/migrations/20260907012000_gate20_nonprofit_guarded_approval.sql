create schema if not exists nonprofit_api;

create or replace function nonprofit_api.decide_approval_step(
  p_step_id uuid,
  p_decision text,
  p_notes text default null
)
returns table (
  approval_id uuid,
  step_id uuid,
  step_decision text,
  approval_status text,
  audit_event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_aal text := (select auth.jwt() ->> 'aal');
  v_step nonprofit_security.approval_steps%rowtype;
  v_approval nonprofit_security.approvals%rowtype;
  v_policy nonprofit_security.policy_decisions%rowtype;
  v_prev_hash text;
  v_event_id uuid := gen_random_uuid();
  v_event_at timestamptz := now();
  v_event_hash text;
  v_parent_status text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if v_aal is distinct from 'aal2' then raise exception 'MFA_AAL2_REQUIRED' using errcode = '42501'; end if;
  if p_decision not in ('APPROVED','REJECTED','RECUSED') then raise exception 'INVALID_DECISION' using errcode = '22023'; end if;

  select s.* into v_step from nonprofit_security.approval_steps s where s.id = p_step_id for update;
  if not found then raise exception 'APPROVAL_STEP_NOT_FOUND' using errcode = 'P0002'; end if;

  select a.* into v_approval from nonprofit_security.approvals a where a.id = v_step.approval_id for update;
  if v_approval.status <> 'PENDING' then raise exception 'APPROVAL_NOT_PENDING' using errcode = '55000'; end if;
  if v_step.decision <> 'PENDING' then raise exception 'STEP_ALREADY_DECIDED' using errcode = '55000'; end if;

  if not exists (
    select 1 from nonprofit_security.memberships m
    where m.organization_id = v_approval.organization_id
      and m.user_id = v_user and m.active and m.can_approve and m.role = v_step.required_role
  ) then raise exception 'ROLE_NOT_AUTHORIZED' using errcode = '42501'; end if;

  if v_step.approver_user_id is not null and v_step.approver_user_id <> v_user then
    raise exception 'NOT_ASSIGNED_APPROVER' using errcode = '42501';
  end if;

  if p_decision <> 'RECUSED' and nonprofit_security.is_recused(v_approval.organization_id, 'APPROVAL', v_approval.id) then
    raise exception 'APPROVER_RECUSED' using errcode = '42501';
  end if;

  select p.* into v_policy
  from nonprofit_security.policy_decisions p
  where p.organization_id = v_approval.organization_id
    and p.action_type = v_approval.action_type
    and p.resource_type = v_approval.resource_type
    and p.resource_id is not distinct from v_approval.resource_id
  order by p.evaluated_at desc limit 1;

  if not found then raise exception 'POLICY_DECISION_REQUIRED' using errcode = '42501'; end if;
  if v_policy.decision = 'RED' then raise exception 'POLICY_BLOCKED_RED' using errcode = '42501'; end if;

  update nonprofit_security.approval_steps
  set decision = p_decision,
      approver_user_id = coalesce(approver_user_id, v_user),
      decided_at = v_event_at,
      notes = nullif(btrim(p_notes), '')
  where id = v_step.id;

  if p_decision = 'REJECTED' or exists (
    select 1 from nonprofit_security.approval_steps s where s.approval_id = v_approval.id and s.decision = 'REJECTED'
  ) then
    v_parent_status := 'REJECTED';
  elsif not exists (
    select 1 from nonprofit_security.approval_steps s where s.approval_id = v_approval.id and s.decision = 'PENDING'
  ) and exists (
    select 1 from nonprofit_security.approval_steps s where s.approval_id = v_approval.id and s.decision = 'APPROVED'
  ) then
    v_parent_status := 'APPROVED';
  else
    v_parent_status := 'PENDING';
  end if;

  if v_parent_status in ('APPROVED','REJECTED') then
    update nonprofit_security.approvals
    set status = v_parent_status::nonprofit.approval_status,
        approved_by = case when v_parent_status='APPROVED' then v_user else approved_by end,
        approved_at = case when v_parent_status='APPROVED' then v_event_at else approved_at end
    where id = v_approval.id;
  end if;

  select ae.event_hash into v_prev_hash
  from nonprofit_security.audit_events ae
  where ae.organization_id = v_approval.organization_id
  order by ae.event_at desc, ae.id desc limit 1;

  v_event_hash := encode(extensions.digest(
    concat_ws('|', coalesce(v_prev_hash,''), v_event_id::text, v_approval.organization_id::text,
      v_event_at::text, 'USER', v_user::text, 'APPROVAL_STEP_DECISION', v_approval.id::text,
      p_decision, v_policy.id::text)::bytea,
    'sha256'
  ), 'hex');

  insert into nonprofit_security.audit_events (
    id, organization_id, event_at, actor_type, actor_id, event_type,
    resource_type, resource_id, action, policy_decision_id, approval_id,
    result, previous_event_hash, event_hash
  ) values (
    v_event_id, v_approval.organization_id, v_event_at, 'USER', v_user,
    'APPROVAL_STEP_DECISION', 'approval', v_approval.id, p_decision,
    v_policy.id, v_approval.id, v_parent_status, v_prev_hash, v_event_hash
  );

  return query select v_approval.id, v_step.id, p_decision, v_parent_status, v_event_id;
end;
$$;

revoke all on function nonprofit_api.decide_approval_step(uuid,text,text) from public;
revoke all on function nonprofit_api.decide_approval_step(uuid,text,text) from anon;
grant execute on function nonprofit_api.decide_approval_step(uuid,text,text) to authenticated;

create or replace function public.nonprofit_decide_approval_step(
  p_step_id uuid,
  p_decision text,
  p_notes text default null
)
returns table (
  approval_id uuid,
  step_id uuid,
  step_decision text,
  approval_status text,
  audit_event_id uuid
)
language sql
security invoker
set search_path = ''
as $$
  select * from nonprofit_api.decide_approval_step(p_step_id, p_decision, p_notes);
$$;

revoke all on function public.nonprofit_decide_approval_step(uuid,text,text) from public;
revoke all on function public.nonprofit_decide_approval_step(uuid,text,text) from anon;
grant execute on function public.nonprofit_decide_approval_step(uuid,text,text) to authenticated;
