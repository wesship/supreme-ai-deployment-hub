-- PRIMETIME Release 1 — Enforcement and workspace initialization
create or replace function public.primetime_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.primetime_prevent_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'primetime audit records are immutable';
end;
$$;

drop trigger if exists primetime_audit_events_immutable on public.primetime_audit_events;
create trigger primetime_audit_events_immutable
before update or delete on public.primetime_audit_events
for each row execute function public.primetime_prevent_audit_mutation();

create or replace function public.primetime_record_stage_transition()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into public.primetime_stage_transitions(workspace_id, lead_id, from_stage_id, to_stage_id, changed_by, reason)
    values(new.workspace_id, new.id, null, new.pipeline_stage_id, new.owner_id, 'initial_stage');
    return new;
  end if;

  if old.pipeline_stage_id is distinct from new.pipeline_stage_id then
    insert into public.primetime_stage_transitions(workspace_id, lead_id, from_stage_id, to_stage_id, changed_by, reason)
    values(new.workspace_id, new.id, old.pipeline_stage_id, new.pipeline_stage_id, new.owner_id, 'stage_changed');
  end if;
  return new;
end;
$$;

drop trigger if exists primetime_lead_stage_transition on public.primetime_leads;
create trigger primetime_lead_stage_transition
after insert or update of pipeline_stage_id on public.primetime_leads
for each row execute function public.primetime_record_stage_transition();

create or replace function public.primetime_update_lead_last_activity()
returns trigger language plpgsql as $$
begin
  if new.lead_id is not null then
    update public.primetime_leads
    set last_activity_at = greatest(coalesce(last_activity_at, new.created_at), new.created_at), updated_at = now()
    where id = new.lead_id;
  end if;
  return new;
end;
$$;

drop trigger if exists primetime_activity_updates_lead on public.primetime_activities;
create trigger primetime_activity_updates_lead
after insert on public.primetime_activities
for each row execute function public.primetime_update_lead_last_activity();

create or replace function public.primetime_seed_pipeline_stages(target_workspace_id uuid)
returns void language plpgsql as $$
begin
  insert into public.primetime_pipeline_stages(workspace_id, code, name, position, is_open, required_fields) values
    (target_workspace_id, 'new_lead', 'New Lead', 10, true, '["owner_id","source","person_id"]'),
    (target_workspace_id, 'contact_attempted', 'Contact Attempted', 20, true, '["last_activity_at"]'),
    (target_workspace_id, 'contacted', 'Contacted', 30, true, '["consent_state","next_action"]'),
    (target_workspace_id, 'appointment_scheduled', 'Appointment Scheduled', 40, true, '["next_action_due_at"]'),
    (target_workspace_id, 'appointment_completed', 'Appointment Completed', 50, true, '["last_activity_at"]'),
    (target_workspace_id, 'needs_analysis', 'Needs Analysis', 60, true, '["last_activity_at"]'),
    (target_workspace_id, 'application_started', 'Application Started', 70, true, '["last_activity_at"]'),
    (target_workspace_id, 'application_submitted', 'Application Submitted', 80, true, '["last_activity_at"]'),
    (target_workspace_id, 'underwriting', 'Underwriting', 90, true, '["next_action_due_at"]'),
    (target_workspace_id, 'approved', 'Approved', 100, true, '["last_activity_at"]'),
    (target_workspace_id, 'policy_issued', 'Policy Issued', 110, false, '["last_activity_at"]'),
    (target_workspace_id, 'active_client', 'Active Client', 120, false, '["last_activity_at"]'),
    (target_workspace_id, 'not_ready', 'Not Ready', 130, false, '[]'),
    (target_workspace_id, 'closed', 'Closed', 140, false, '[]')
  on conflict(workspace_id, code) do nothing;
end;
$$;

create or replace function public.primetime_scan_release1_exceptions(target_workspace_id uuid)
returns integer language plpgsql as $$
declare inserted_count integer;
begin
  insert into public.primetime_release_exceptions(workspace_id, entity_type, entity_id, exception_type, severity, details)
  select
    l.workspace_id,
    'lead',
    l.id,
    'release1_open_lead_missing_required_control',
    'critical',
    jsonb_build_object(
      'missing_owner', l.owner_id is null,
      'missing_stage', l.pipeline_stage_id is null,
      'missing_source', l.source is null or length(l.source) = 0,
      'missing_next_action', l.next_action is null or length(l.next_action) = 0,
      'missing_next_action_due_at', l.next_action_due_at is null,
      'missing_last_activity', l.last_activity_at is null,
      'consent_state', l.consent_state
    )
  from public.primetime_leads l
  where l.workspace_id = target_workspace_id
    and l.status = 'open'
    and (
      l.owner_id is null
      or l.pipeline_stage_id is null
      or l.source is null
      or length(l.source) = 0
      or l.next_action is null
      or length(l.next_action) = 0
      or l.next_action_due_at is null
      or l.last_activity_at is null
      or l.consent_state = 'unknown'
    );
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.primetime_initialize_workspace()
returns trigger language plpgsql as $$
begin
  perform public.primetime_seed_pipeline_stages(new.id);
  return new;
end;
$$;

drop trigger if exists primetime_workspace_initialize on public.primetime_workspaces;
create trigger primetime_workspace_initialize
after insert on public.primetime_workspaces
for each row execute function public.primetime_initialize_workspace();

