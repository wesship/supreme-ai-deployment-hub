-- Server-enforced, time-bounded Agent OS production canary unlock.
-- A browser crash or lost response cannot leave the runtime effectively unlocked:
-- policy resolution treats an expired canary_unlock_expires_at as kill-switch ON.

alter table public.agent_os_workspace_policies
  add column if not exists canary_unlock_expires_at timestamptz;

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
  insert into public.agent_os_workspace_policies
    (workspace_id, kill_switch_enabled, disabled_agents, canary_unlock_expires_at, updated_by, updated_at)
  values
    (p_workspace_id, p_kill_switch_enabled, v_disabled_agents, null, p_actor_user_id, now())
  on conflict (workspace_id) do update set
    kill_switch_enabled = excluded.kill_switch_enabled,
    disabled_agents = excluded.disabled_agents,
    canary_unlock_expires_at = null,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning * into v_after;
  insert into public.primetime_audit_events (workspace_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_workspace_id, p_actor_user_id, 'agent_os.workspace_policy.updated', 'agent_os_workspace_policy', p_workspace_id,
    jsonb_build_object('before', case when v_before.workspace_id is null then null else to_jsonb(v_before) end, 'after', to_jsonb(v_after), 'reason', p_reason));
  return v_after;
end;
$$;

create or replace function public.agent_os_set_canary_unlock_lease(
  p_workspace_id uuid,
  p_disabled_agents text[],
  p_actor_user_id uuid,
  p_lease_seconds integer default 90,
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
  v_expires_at timestamptz;
begin
  if p_actor_user_id is null then raise exception 'actor_user_id is required'; end if;
  if p_lease_seconds < 15 or p_lease_seconds > 180 then
    raise exception 'canary lease must be between 15 and 180 seconds';
  end if;
  if exists (select 1 from unnest(coalesce(p_disabled_agents, '{}'::text[])) as agent_name where length(trim(agent_name)) = 0) then
    raise exception 'disabled agent names must be nonblank';
  end if;
  select coalesce(array_agg(distinct trim(agent_name) order by trim(agent_name)), '{}'::text[]) into v_disabled_agents
  from unnest(coalesce(p_disabled_agents, '{}'::text[])) as agent_name;
  v_expires_at := now() + make_interval(secs => p_lease_seconds);
  select * into v_before from public.agent_os_workspace_policies where workspace_id = p_workspace_id;
  insert into public.agent_os_workspace_policies
    (workspace_id, kill_switch_enabled, disabled_agents, canary_unlock_expires_at, updated_by, updated_at)
  values
    (p_workspace_id, false, v_disabled_agents, v_expires_at, p_actor_user_id, now())
  on conflict (workspace_id) do update set
    kill_switch_enabled = false,
    disabled_agents = excluded.disabled_agents,
    canary_unlock_expires_at = excluded.canary_unlock_expires_at,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning * into v_after;
  insert into public.primetime_audit_events (workspace_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_workspace_id, p_actor_user_id, 'agent_os.canary_lease.started', 'agent_os_workspace_policy', p_workspace_id,
    jsonb_build_object('before', case when v_before.workspace_id is null then null else to_jsonb(v_before) end, 'after', to_jsonb(v_after),
      'lease_seconds', p_lease_seconds, 'expires_at', v_expires_at, 'reason', p_reason));
  return v_after;
end;
$$;

revoke all on function public.agent_os_set_canary_unlock_lease(uuid, text[], uuid, integer, text) from public, anon, authenticated;
grant execute on function public.agent_os_set_canary_unlock_lease(uuid, text[], uuid, integer, text) to service_role;

comment on column public.agent_os_workspace_policies.canary_unlock_expires_at is
  'Optional server-enforced canary unlock deadline; expired leases resolve as kill-switch ON.';
