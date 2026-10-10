-- Route Hermes tasks by required capabilities inside the atomic claim boundary.
-- A new function name avoids incompatible historical overload return types.

begin;

create or replace function public.hermes_claim_capability_task(
  p_worker_id text,
  p_lease_ttl_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_worker public.hermes_workers%rowtype;
  v_task public.hermes_tasks%rowtype;
  v_worker_capabilities text[];
  v_lease_id text;
  v_expires_at timestamptz;
begin
  if coalesce(nullif(pg_catalog.btrim(p_worker_id), ''), '') = '' then
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
  if v_worker.status not in ('healthy', 'busy') then return null; end if;
  if v_worker.active_leases >= v_worker.max_leases then return null; end if;

  select coalesce(
           pg_catalog.array_agg(distinct pg_catalog.lower(pg_catalog.btrim(capability.value))),
           array[]::text[]
         )
    into v_worker_capabilities
    from pg_catalog.jsonb_array_elements_text(
           coalesce(v_worker.capabilities, '[]'::jsonb)
         ) as capability(value)
   where pg_catalog.btrim(capability.value) <> '';

  select queue.*
    into v_task
    from public.hermes_tasks as queue
   where queue.status in ('PENDING', 'RETRY')
     and coalesce(queue.scheduled_at, queue.created_at) <= pg_catalog.now()
     and (queue.deadline_at is null or queue.deadline_at > pg_catalog.now())
     and pg_catalog.lower(coalesce(queue.agent_name, '')) <> 'ai-films-mastering'
     and (
       '*' = any(v_worker_capabilities)
       or 'task-dispatch' = any(v_worker_capabilities)
       or 'task_execution' = any(v_worker_capabilities)
       or pg_catalog.lower(queue.task_type) = any(v_worker_capabilities)
     )
     and case
       when not (coalesce(queue.input_data, '{}'::jsonb) ? 'required_capabilities')
         then true
       when pg_catalog.jsonb_typeof(
              queue.input_data -> 'required_capabilities'
            ) <> 'array'
         then false
       else not exists (
         select 1
           from pg_catalog.jsonb_array_elements(
                  queue.input_data -> 'required_capabilities'
                ) as required(value)
          where pg_catalog.jsonb_typeof(required.value) <> 'string'
             or coalesce(pg_catalog.btrim(required.value #>> '{}'), '') = ''
             or (
               not ('*' = any(v_worker_capabilities))
               and not (
                 pg_catalog.lower(pg_catalog.btrim(required.value #>> '{}'))
                 = any(v_worker_capabilities)
               )
             )
       )
     end
   order by
     queue.priority asc,
     coalesce(queue.scheduled_at, queue.created_at) asc,
     queue.created_at asc
   limit 1
   for update skip locked;

  if not found then return null; end if;

  v_lease_id := 'lease_' || pg_catalog.replace(gen_random_uuid()::text, '-', '');
  v_expires_at := pg_catalog.now() + pg_catalog.make_interval(
    secs => greatest(coalesce(p_lease_ttl_seconds, 300), 30)
  );

  update public.hermes_tasks
     set status = 'LOCKED',
         assigned_to = p_worker_id,
         assigned_at = pg_catalog.now(),
         locked_at = pg_catalog.now(),
         updated_at = pg_catalog.now()
   where id = v_task.id;

  insert into public.hermes_worker_leases (
    lease_id, task_id, worker_id, capabilities,
    acquired_at, renewed_at, expires_at, status
  ) values (
    v_lease_id, v_task.id, p_worker_id, pg_catalog.to_jsonb(v_worker_capabilities),
    pg_catalog.now(), pg_catalog.now(), v_expires_at, 'active'
  );

  update public.hermes_workers as worker
     set active_leases = active_leases + 1,
         status = case
           when active_leases + 1 >= max_leases then 'busy'
           else 'healthy'
         end,
         last_heartbeat_at = pg_catalog.now(),
         version_counter = version_counter + 1,
         updated_at = pg_catalog.now()
   where worker.worker_id = p_worker_id;

  return pg_catalog.jsonb_build_object(
    'task_id', v_task.id,
    'lease_id', v_lease_id,
    'title', v_task.title,
    'description', v_task.description,
    'task_type', v_task.task_type,
    'input_data', coalesce(v_task.input_data, '{}'::jsonb),
    'agent_name', v_task.agent_name,
    'correlation_id', v_task.correlation_id,
    'retry_count', v_task.retry_count,
    'task_status', 'LOCKED',
    'worker_id', p_worker_id,
    'capabilities', pg_catalog.to_jsonb(v_worker_capabilities),
    'acquired_at', pg_catalog.now(),
    'renewed_at', pg_catalog.now(),
    'expires_at', v_expires_at,
    'lease_status', 'active'
  );
end;
$$;

revoke execute on function public.hermes_claim_capability_task(text, integer)
  from public, anon, authenticated;
grant execute on function public.hermes_claim_capability_task(text, integer)
  to service_role;

commit;
