begin;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_updated_at before update on public.workspaces for each row execute function public.set_updated_at();
create trigger memberships_updated_at before update on public.workspace_memberships for each row execute function public.set_updated_at();
create trigger people_updated_at before update on public.people for each row execute function public.set_updated_at();
create trigger households_updated_at before update on public.households for each row execute function public.set_updated_at();
create trigger leads_updated_at before update on public.leads for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();

create or replace function public.validate_open_lead_required_fields()
returns trigger language plpgsql as $$
begin
  if new.status = 'open' then
    if new.owner_user_id is null then
      raise exception 'open leads require owner_user_id';
    end if;
    if new.stage_id is null then
      raise exception 'open leads require stage_id';
    end if;
    if nullif(new.next_action, '') is null then
      raise exception 'open leads require next_action';
    end if;
    if new.next_action_due_at is null then
      raise exception 'open leads require next_action_due_at';
    end if;
    if nullif(new.source, '') is null then
      raise exception 'open leads require source';
    end if;
    if new.consent_state is null then
      raise exception 'open leads require consent_state';
    end if;
  end if;
  return new;
end;
$$;

create trigger leads_required_fields
before insert or update on public.leads
for each row execute function public.validate_open_lead_required_fields();

create or replace function public.record_stage_transition()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into public.stage_transitions (workspace_id, lead_id, from_stage_id, to_stage_id, changed_by, reason)
    values (new.workspace_id, new.id, null, new.stage_id, new.created_by, 'initial_stage');
  elsif new.stage_id is distinct from old.stage_id then
    insert into public.stage_transitions (workspace_id, lead_id, from_stage_id, to_stage_id, changed_by, reason)
    values (new.workspace_id, new.id, old.stage_id, new.stage_id, new.created_by, 'stage_changed');
  end if;
  return new;
end;
$$;

create trigger leads_stage_transition
before insert or update of stage_id on public.leads
for each row execute function public.record_stage_transition();

create or replace function public.update_lead_last_activity()
returns trigger language plpgsql as $$
begin
  if new.lead_id is not null then
    update public.leads
    set last_activity_at = greatest(coalesce(last_activity_at, new.occurred_at), new.occurred_at),
        updated_at = now()
    where id = new.lead_id;
  end if;
  return new;
end;
$$;

create trigger activities_update_lead_last_activity
after insert on public.activities
for each row execute function public.update_lead_last_activity();

create or replace function public.create_lead_exception(rule_key text, target_lead public.leads, details jsonb)
returns void language plpgsql as $$
begin
  insert into public.release_gate_exceptions (workspace_id, entity_type, entity_id, rule_key, severity, details)
  values (target_lead.workspace_id, 'lead', target_lead.id, rule_key, 'critical', details)
  on conflict do nothing;
end;
$$;

create or replace function public.scan_release1_lead_exceptions(target_workspace_id uuid)
returns integer language plpgsql as $$
declare
  item public.leads%rowtype;
  created_count integer := 0;
begin
  for item in select * from public.leads where workspace_id = target_workspace_id and status = 'open' loop
    if item.owner_user_id is null then
      perform public.create_lead_exception('lead.owner.required', item, jsonb_build_object('field','owner_user_id'));
      created_count := created_count + 1;
    end if;
    if nullif(item.next_action, '') is null or item.next_action_due_at is null then
      perform public.create_lead_exception('lead.next_action.required', item, jsonb_build_object('field','next_action'));
      created_count := created_count + 1;
    end if;
    if item.consent_state in ('unknown','blocked','opted_out') then
      perform public.create_lead_exception('lead.consent.review_required', item, jsonb_build_object('consent_state', item.consent_state));
      created_count := created_count + 1;
    end if;
    if item.last_activity_at is null then
      perform public.create_lead_exception('lead.activity.required', item, jsonb_build_object('field','last_activity_at'));
      created_count := created_count + 1;
    end if;
  end loop;
  return created_count;
end;
$$;

create or replace function public.seed_primetime_pipeline(target_workspace_id uuid)
returns void language plpgsql as $$
begin
  insert into public.pipeline_stages (workspace_id, system_key, name, position, is_closed, required_fields)
  values
    (target_workspace_id, 'new_lead', 'New Lead', 10, false, array['owner_user_id','source','contact_information']),
    (target_workspace_id, 'contact_attempted', 'Contact Attempted', 20, false, array['attempt_date','channel','outcome']),
    (target_workspace_id, 'contacted', 'Contacted', 30, false, array['consent_state','next_action']),
    (target_workspace_id, 'appointment_scheduled', 'Appointment Scheduled', 40, false, array['appointment_date','participants','meeting_type']),
    (target_workspace_id, 'appointment_completed', 'Appointment Completed', 50, false, array['meeting_result','follow_up']),
    (target_workspace_id, 'needs_analysis', 'Needs Analysis', 60, false, array['needs_analysis','agent_attestation']),
    (target_workspace_id, 'application_started', 'Application Started', 70, false, array['product_category','licensed_agent']),
    (target_workspace_id, 'application_submitted', 'Application Submitted', 80, false, array['submission_date','application_reference']),
    (target_workspace_id, 'underwriting', 'Underwriting', 90, false, array['status','next_expected_update']),
    (target_workspace_id, 'approved', 'Approved', 100, false, array['approval_date','conditions']),
    (target_workspace_id, 'policy_issued', 'Policy Issued', 110, false, array['policy_identifier','issue_date','status']),
    (target_workspace_id, 'active_client', 'Active Client', 120, false, array['service_plan','review_date','referral_request_status']),
    (target_workspace_id, 'not_ready', 'Not Ready', 900, true, array['reason']),
    (target_workspace_id, 'closed', 'Closed', 999, true, array['close_reason'])
  on conflict (workspace_id, system_key) do update
  set name = excluded.name,
      position = excluded.position,
      is_closed = excluded.is_closed,
      required_fields = excluded.required_fields;
end;
$$;

commit;
