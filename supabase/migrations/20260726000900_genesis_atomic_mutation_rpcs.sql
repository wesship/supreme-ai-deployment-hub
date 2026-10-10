-- Atomic governed mutations for task transitions and approval decisions.
-- Each RPC commits the state change and its audit/outbox event in one transaction.

create or replace function public.genesis_transition_task(
  p_task_id uuid,
  p_expected_status text,
  p_new_status text,
  p_output jsonb default null,
  p_completed_at timestamptz default null,
  p_actor_id uuid default null,
  p_reason text default null
)
returns public.genesis_tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.genesis_tasks;
begin
  update public.genesis_tasks
  set status = p_new_status,
      output = case when p_output is null then output else p_output end,
      completed_at = case when p_completed_at is null then completed_at else p_completed_at end,
      updated_at = now()
  where id = p_task_id
    and status = p_expected_status
  returning * into v_task;

  if v_task.id is null then
    return null;
  end if;

  perform public.genesis_emit_event(
    v_task.project_id,
    'task.' || p_new_status,
    'task',
    v_task.id,
    'user',
    p_actor_id,
    jsonb_build_object(
      'previous_status', p_expected_status,
      'reason', p_reason
    )
  );

  return v_task;
end;
$$;

revoke all on function public.genesis_transition_task(uuid, text, text, jsonb, timestamptz, uuid, text) from public;
revoke all on function public.genesis_transition_task(uuid, text, text, jsonb, timestamptz, uuid, text) from anon;
revoke all on function public.genesis_transition_task(uuid, text, text, jsonb, timestamptz, uuid, text) from authenticated;
grant execute on function public.genesis_transition_task(uuid, text, text, jsonb, timestamptz, uuid, text) to service_role;

create or replace function public.genesis_decide_approval(
  p_approval_id uuid,
  p_decision text,
  p_decided_by_user_id uuid,
  p_notes text default null,
  p_conditions jsonb default null
)
returns public.genesis_approvals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_approval public.genesis_approvals;
  v_render_status text;
begin
  update public.genesis_approvals
  set status = p_decision,
      decided_by_user_id = p_decided_by_user_id,
      decision_notes = p_notes,
      conditions = coalesce(p_conditions, conditions, '{}'::jsonb),
      decided_at = now()
  where id = p_approval_id
    and status = 'pending'
  returning * into v_approval;

  if v_approval.id is null then
    return null;
  end if;

  if v_approval.target_type = 'render_request' then
    v_render_status := case
      when p_decision in ('approved', 'approved_with_conditions') then 'queued'
      else 'rejected'
    end;

    update public.genesis_render_requests
    set status = v_render_status,
        updated_at = now()
    where id = v_approval.target_id
      and project_id = v_approval.project_id;
  end if;

  perform public.genesis_emit_event(
    v_approval.project_id,
    'approval.' || p_decision,
    'approval',
    v_approval.id,
    'user',
    p_decided_by_user_id,
    jsonb_build_object(
      'target_type', v_approval.target_type,
      'target_id', v_approval.target_id
    )
  );

  return v_approval;
end;
$$;

revoke all on function public.genesis_decide_approval(uuid, text, uuid, text, jsonb) from public;
revoke all on function public.genesis_decide_approval(uuid, text, uuid, text, jsonb) from anon;
revoke all on function public.genesis_decide_approval(uuid, text, uuid, text, jsonb) from authenticated;
grant execute on function public.genesis_decide_approval(uuid, text, uuid, text, jsonb) to service_role;

comment on function public.genesis_transition_task(uuid, text, text, jsonb, timestamptz, uuid, text) is
  'Conditionally transitions one task and emits its domain/outbox event atomically.';
comment on function public.genesis_decide_approval(uuid, text, uuid, text, jsonb) is
  'Conditionally decides one pending approval, updates its render target, and emits its event atomically.';

-- PostgREST no longer guarantees default table grants for newly created public tables.
-- Genesis persistence is backend-only and uses the service-role key, so grant only
-- the table privileges required by that trusted repository adapter.
grant select, insert, update, delete on table
  public.genesis_agents,
  public.genesis_approvals,
  public.genesis_asset_versions,
  public.genesis_assets,
  public.genesis_canon_entries,
  public.genesis_domain_events,
  public.genesis_entities,
  public.genesis_evaluation_runs,
  public.genesis_event_outbox,
  public.genesis_execution_checkpoints,
  public.genesis_executions,
  public.genesis_findings,
  public.genesis_goals,
  public.genesis_idempotency_records,
  public.genesis_project_members,
  public.genesis_projects,
  public.genesis_provider_jobs,
  public.genesis_provider_outputs,
  public.genesis_relationships,
  public.genesis_release_gates,
  public.genesis_render_requests,
  public.genesis_reviews,
  public.genesis_tasks,
  public.genesis_workflow_definitions,
  public.genesis_workflow_runs,
  public.genesis_workflow_steps
to service_role;
