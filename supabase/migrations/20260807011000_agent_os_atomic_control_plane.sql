-- Agent OS atomic governance control-plane mutations.
-- Each policy/approval mutation commits with PRIMETIME audit evidence or rolls back.

create or replace function public.agent_os_set_workspace_policy(
  p_workspace_id uuid,
  p_kill_switch_enabled boolean,
  p_disabled_agents text[],
  p_actor_user_id uuid,
  p_reason text default null
)
returns public.agent_os_workspace_policies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.agent_os_workspace_policies;
  v_after public.agent_os_workspace_policies;
  v_disabled_agents text[];
begin
  if p_actor_user_id is null then raise exception 'actor_user_id is required'; end if;
  if exists (select 1 from unnest(coalesce(p_disabled_agents, '{}'::text[])) as agent_name where length(trim(agent_name)) = 0) then
    raise exception 'disabled agent names must be nonblank';
  end if;
  select coalesce(array_agg(distinct trim(agent_name) order by trim(agent_name)), '{}'::text[]) into v_disabled_agents
  from unnest(coalesce(p_disabled_agents, '{}'::text[])) as agent_name;
  select * into v_before from public.agent_os_workspace_policies where workspace_id = p_workspace_id;
  insert into public.agent_os_workspace_policies (workspace_id, kill_switch_enabled, disabled_agents, updated_by, updated_at)
  values (p_workspace_id, p_kill_switch_enabled, v_disabled_agents, p_actor_user_id, now())
  on conflict (workspace_id) do update set
    kill_switch_enabled = excluded.kill_switch_enabled,
    disabled_agents = excluded.disabled_agents,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning * into v_after;
  insert into public.primetime_audit_events (workspace_id, actor_user_id, event_type, entity_type, entity_id, event_data)
  values (p_workspace_id, p_actor_user_id, 'agent_os.workspace_policy.updated', 'agent_os_workspace_policy', p_workspace_id,
    jsonb_build_object('before', case when v_before.workspace_id is null then null else to_jsonb(v_before) end, 'after', to_jsonb(v_after), 'reason', p_reason));
  return v_after;
end;
$$;

create or replace function public.agent_os_grant_approval(
  p_workspace_id uuid,
  p_action text,
  p_agent_name text,
  p_actor_user_id uuid,
  p_expires_at timestamptz,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.agent_os_approvals
language plpgsql security definer set search_path = public
as $$
declare v_approval public.agent_os_approvals;
begin
  if p_actor_user_id is null then raise exception 'actor_user_id is required'; end if;
  if p_action is null or length(trim(p_action)) = 0 then raise exception 'action must be nonblank'; end if;
  if p_agent_name is not null and length(trim(p_agent_name)) = 0 then raise exception 'agent_name must be null or nonblank'; end if;
  if p_expires_at is null or p_expires_at <= now() then raise exception 'expires_at must be in the future'; end if;
  insert into public.agent_os_approvals (workspace_id, action, agent_name, approved_by, approved_at, expires_at, reason, metadata)
  values (p_workspace_id, trim(p_action), case when p_agent_name is null then null else trim(p_agent_name) end,
    p_actor_user_id, now(), p_expires_at, p_reason, coalesce(p_metadata, '{}'::jsonb)) returning * into v_approval;
  insert into public.primetime_audit_events (workspace_id, actor_user_id, event_type, entity_type, entity_id, event_data)
  values (p_workspace_id, p_actor_user_id, 'agent_os.approval.granted', 'agent_os_approval', v_approval.id,
    jsonb_build_object('action', v_approval.action, 'agent_name', v_approval.agent_name, 'expires_at', v_approval.expires_at, 'reason', v_approval.reason, 'metadata', v_approval.metadata));
  return v_approval;
end;
$$;

create or replace function public.agent_os_revoke_approval(
  p_workspace_id uuid,
  p_approval_id uuid,
  p_actor_user_id uuid,
  p_reason text default null
)
returns public.agent_os_approvals
language plpgsql security definer set search_path = public
as $$
declare v_approval public.agent_os_approvals;
begin
  if p_actor_user_id is null then raise exception 'actor_user_id is required'; end if;
  update public.agent_os_approvals set revoked_at = now()
  where id = p_approval_id and workspace_id = p_workspace_id and revoked_at is null
  returning * into v_approval;
  if v_approval.id is null then raise exception 'active approval not found for workspace'; end if;
  insert into public.primetime_audit_events (workspace_id, actor_user_id, event_type, entity_type, entity_id, event_data)
  values (p_workspace_id, p_actor_user_id, 'agent_os.approval.revoked', 'agent_os_approval', v_approval.id,
    jsonb_build_object('action', v_approval.action, 'agent_name', v_approval.agent_name, 'approved_by', v_approval.approved_by,
      'approved_at', v_approval.approved_at, 'expires_at', v_approval.expires_at, 'revoked_at', v_approval.revoked_at,
      'revoked_by', p_actor_user_id, 'reason', p_reason));
  return v_approval;
end;
$$;

revoke all on function public.agent_os_set_workspace_policy(uuid, boolean, text[], uuid, text) from public, anon, authenticated;
revoke all on function public.agent_os_grant_approval(uuid, text, text, uuid, timestamptz, text, jsonb) from public, anon, authenticated;
revoke all on function public.agent_os_revoke_approval(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.agent_os_set_workspace_policy(uuid, boolean, text[], uuid, text) to service_role;
grant execute on function public.agent_os_grant_approval(uuid, text, text, uuid, timestamptz, text, jsonb) to service_role;
grant execute on function public.agent_os_revoke_approval(uuid, uuid, uuid, text) to service_role;
