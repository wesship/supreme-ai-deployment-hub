-- Genesis workflow synchronization and security hardening.

-- Canonical project keys are tenant-scoped. Downstream entity keys include the
-- project key, so this avoids cross-tenant title collisions without weakening identity.
alter table public.genesis_projects
  drop constraint if exists genesis_projects_canonical_key_key;

create unique index if not exists genesis_projects_owner_canonical_key_idx
  on public.genesis_projects(owner_id, canonical_key);

alter table public.genesis_approvals
  add column if not exists created_at timestamptz not null default now();

-- Mutating SECURITY DEFINER functions are backend-only. The service-role backend
-- performs project authorization before calling them.
revoke all on function public.genesis_claim_task(uuid, uuid, integer) from public;
revoke all on function public.genesis_claim_task(uuid, uuid, integer) from anon;
revoke all on function public.genesis_claim_task(uuid, uuid, integer) from authenticated;
grant execute on function public.genesis_claim_task(uuid, uuid, integer) to service_role;

revoke all on function public.genesis_emit_event(uuid, text, text, uuid, text, uuid, jsonb, uuid, uuid) from public;
revoke all on function public.genesis_emit_event(uuid, text, text, uuid, text, uuid, jsonb, uuid, uuid) from anon;
revoke all on function public.genesis_emit_event(uuid, text, text, uuid, text, uuid, jsonb, uuid, uuid) from authenticated;
grant execute on function public.genesis_emit_event(uuid, text, text, uuid, text, uuid, jsonb, uuid, uuid) to service_role;

create or replace function public.genesis_sync_task_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workflow_id uuid;
  v_progress numeric(5,4);
  v_all_complete boolean;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Keep the workflow step projection synchronized with its backing task.
  select s.workflow_run_id
    into v_workflow_id
  from public.genesis_workflow_steps s
  where s.input ->> 'task_id' = new.id::text
  limit 1;

  if v_workflow_id is not null then
    update public.genesis_workflow_steps
    set status = case
          when new.status in ('approved','completed') then 'succeeded'
          when new.status in ('in_progress','claimed') then 'running'
          when new.status = 'ready' then 'ready'
          when new.status = 'waiting' then 'waiting'
          when new.status = 'blocked' then 'blocked'
          when new.status = 'failed' then 'failed'
          when new.status = 'cancelled' then 'cancelled'
          when new.status = 'review' then 'waiting'
          when new.status = 'revision' then 'pending'
          else status
        end,
        started_at = case
          when new.status in ('claimed','in_progress') then coalesce(started_at, now())
          else started_at
        end,
        completed_at = case
          when new.status in ('approved','completed','failed','cancelled') then now()
          else null
        end,
        output = coalesce(new.output, output)
    where workflow_run_id = v_workflow_id
      and input ->> 'task_id' = new.id::text;
  end if;

  -- Completing or approving a task can make dependent backlog work ready.
  if new.status in ('approved','completed') then
    update public.genesis_tasks candidate
    set status = 'ready',
        updated_at = now()
    where candidate.project_id = new.project_id
      and candidate.status = 'backlog'
      and candidate.dependencies ? new.id::text
      and not exists (
        select 1
        from jsonb_array_elements_text(coalesce(candidate.dependencies, '[]'::jsonb)) dependency(task_id)
        left join public.genesis_tasks required_task
          on required_task.id = dependency.task_id::uuid
        where required_task.id is null
           or required_task.status not in ('approved','completed')
      );

    if v_workflow_id is not null then
      update public.genesis_workflow_steps step
      set status = 'ready'
      from public.genesis_tasks task
      where step.workflow_run_id = v_workflow_id
        and step.input ->> 'task_id' = task.id::text
        and task.status = 'ready'
        and step.status = 'pending';
    end if;
  end if;

  if v_workflow_id is not null then
    select coalesce(
      sum(case when status in ('succeeded','skipped','compensated') then weight else 0 end)
        / nullif(sum(weight), 0),
      0
    )::numeric(5,4),
    bool_and(status in ('succeeded','skipped','compensated'))
    into v_progress, v_all_complete
    from public.genesis_workflow_steps
    where workflow_run_id = v_workflow_id;

    update public.genesis_workflow_runs
    set progress = coalesce(v_progress, 0),
        status = case when coalesce(v_all_complete, false) then 'completed' else status end,
        completed_at = case when coalesce(v_all_complete, false) then now() else completed_at end,
        current_phase = case
          when coalesce(v_all_complete, false) then 'complete'
          else coalesce((
            select step_key
            from public.genesis_workflow_steps
            where workflow_run_id = v_workflow_id
              and status in ('running','ready','waiting','blocked')
            order by sequence_order
            limit 1
          ), current_phase)
        end,
        updated_at = now()
    where id = v_workflow_id;
  end if;

  return new;
end;
$$;

drop trigger if exists genesis_tasks_sync_workflow on public.genesis_tasks;
create trigger genesis_tasks_sync_workflow
after update of status, output on public.genesis_tasks
for each row execute function public.genesis_sync_task_workflow();

revoke all on function public.genesis_sync_task_workflow() from public;
revoke all on function public.genesis_sync_task_workflow() from anon;
revoke all on function public.genesis_sync_task_workflow() from authenticated;
grant execute on function public.genesis_sync_task_workflow() to service_role;
