-- Forward repair for the initial atomic-claim function on canonical staging.
-- Replaces an ambiguous unqualified hermes_workers.worker_id reference.

create or replace function public.hermes_claim_task(
  p_worker_id text,
  p_capabilities text[] default array[]::text[],
  p_lease_ttl_seconds integer default 300
)
returns table (
  task_id uuid,
  lease_id text,
  title text,
  description text,
  task_type text,
  input_data jsonb,
  agent_name text,
  correlation_id uuid,
  retry_count integer,
  task_status text,
  worker_id text,
  capabilities jsonb,
  acquired_at timestamptz,
  renewed_at timestamptz,
  expires_at timestamptz,
  lease_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker public.hermes_workers%rowtype;
  v_task public.hermes_tasks%rowtype;
  v_worker_capabilities text[];
  v_requested_capabilities text[];
  v_lease_id text;
  v_expires_at timestamptz;
begin
  if coalesce(nullif(btrim(p_worker_id), ''), '') = '' then
    raise exception 'p_worker_id must not be blank' using errcode = '22023';
  end if;

  select *
    into v_worker
    from public.hermes_workers as worker
   where worker.worker_id = p_worker_id
   for update;

  if not found then
    raise exception 'Hermes worker % is not registered', p_worker_id
      using errcode = 'P0002';
  end if;

  if v_worker.status not in ('healthy', 'busy') then
    return;
  end if;

  if v_worker.active_leases >= v_worker.max_leases then
    return;
  end if;

  select coalesce(array_agg(value), array[]::text[])
    into v_worker_capabilities
    from jsonb_array_elements_text(v_worker.capabilities) as capability(value);

  select coalesce(array_agg(lower(btrim(value))), array[]::text[])
    into v_requested_capabilities
    from unnest(coalesce(p_capabilities, array[]::text[])) as capability(value)
   where btrim(value) <> '';

  if exists (
    select 1
      from unnest(v_requested_capabilities) as requested(value)
     where not (requested.value = any(v_worker_capabilities))
  ) then
    raise exception 'worker % requested capabilities not registered for that worker', p_worker_id
      using errcode = '42501';
  end if;

  select queue.*
    into v_task
    from public.hermes_tasks as queue
   where queue.status in ('PENDING', 'RETRY')
     and coalesce(queue.scheduled_at, queue.created_at) <= now()
     and (queue.deadline_at is null or queue.deadline_at > now())
     and lower(coalesce(queue.agent_name, '')) <> 'ai-films-mastering'
     and (
       '*' = any(v_worker_capabilities)
       or 'task-dispatch' = any(v_worker_capabilities)
       or 'task_execution' = any(v_worker_capabilities)
       or lower(queue.task_type) = any(v_worker_capabilities)
     )
   order by
     queue.priority asc,
     coalesce(queue.scheduled_at, queue.created_at) asc,
     queue.created_at asc
   limit 1
   for update skip locked;

  if not found then
    return;
  end if;

  v_lease_id := 'lease_' || replace(gen_random_uuid()::text, '-', '');
  v_expires_at := now() + make_interval(secs => greatest(coalesce(p_lease_ttl_seconds, 300), 30));

  update public.hermes_tasks
     set status = 'LOCKED',
         assigned_to = p_worker_id,
         assigned_at = now(),
         locked_at = now(),
         updated_at = now()
   where id = v_task.id;

  insert into public.hermes_worker_leases (
    lease_id,
    task_id,
    worker_id,
    capabilities,
    acquired_at,
    renewed_at,
    expires_at,
    status
  ) values (
    v_lease_id,
    v_task.id,
    p_worker_id,
    to_jsonb(v_worker_capabilities),
    now(),
    now(),
    v_expires_at,
    'active'
  );

  update public.hermes_workers as worker
     set active_leases = active_leases + 1,
         status = case
           when active_leases + 1 >= max_leases then 'busy'
           else 'healthy'
         end,
         last_heartbeat_at = now(),
         version_counter = version_counter + 1,
         updated_at = now()
   where worker.worker_id = p_worker_id;

  return query
  select
    v_task.id,
    v_lease_id,
    v_task.title,
    v_task.description,
    v_task.task_type,
    v_task.input_data,
    v_task.agent_name,
    v_task.correlation_id,
    v_task.retry_count,
    'LOCKED'::text,
    p_worker_id,
    to_jsonb(v_worker_capabilities),
    now(),
    now(),
    v_expires_at,
    'active'::text;
end;
$$;

revoke all on function public.hermes_claim_task(text, text[], integer) from public, anon, authenticated;
grant execute on function public.hermes_claim_task(text, text[], integer) to service_role;
