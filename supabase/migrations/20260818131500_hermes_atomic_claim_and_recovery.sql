-- Canonical Hermes worker lifecycle hardening for Supreme_ai_deployment_hub_staging.
--
-- This migration centralizes task claiming and recovery in PostgreSQL so multiple
-- worker replicas cannot race through REST list-then-insert flows. These RPCs are
-- backend-only; browser roles are explicitly denied execution.

begin;

create index if not exists hermes_tasks_claim_queue_idx
  on public.hermes_tasks (
    priority asc,
    (coalesce(scheduled_at, created_at)) asc,
    created_at asc
  )
  where status in ('PENDING', 'RETRY');

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

create or replace function public.hermes_worker_heartbeat(
  p_worker_id text
)
returns public.hermes_workers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker public.hermes_workers%rowtype;
begin
  update public.hermes_workers
     set status = case
           when status = 'draining' then 'draining'
           when active_leases >= max_leases then 'busy'
           else 'healthy'
         end,
         last_heartbeat_at = now(),
         version_counter = version_counter + 1,
         updated_at = now()
   where worker_id = p_worker_id
     and status not in ('offline', 'lost')
  returning * into v_worker;

  if not found then
    raise exception 'Hermes worker % is not registered or not active', p_worker_id
      using errcode = 'P0002';
  end if;

  return v_worker;
end;
$$;

create or replace function public.hermes_renew_worker_lease(
  p_lease_id text,
  p_lease_ttl_seconds integer default 300
)
returns public.hermes_worker_leases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease public.hermes_worker_leases%rowtype;
begin
  update public.hermes_worker_leases
     set renewed_at = now(),
         expires_at = now() + make_interval(secs => greatest(coalesce(p_lease_ttl_seconds, 300), 30)),
         updated_at = now()
   where lease_id = p_lease_id
     and status = 'active'
  returning * into v_lease;

  if not found then
    raise exception 'Hermes lease % is not active', p_lease_id using errcode = 'P0002';
  end if;

  update public.hermes_workers
     set last_heartbeat_at = now(),
         updated_at = now()
   where worker_id = v_lease.worker_id;

  return v_lease;
end;
$$;

create or replace function public.hermes_release_worker_lease(
  p_lease_id text,
  p_status text default 'released'
)
returns public.hermes_worker_leases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease public.hermes_worker_leases%rowtype;
begin
  if p_status not in ('released', 'cancelled') then
    raise exception 'p_status must be released or cancelled' using errcode = '22023';
  end if;

  update public.hermes_worker_leases
     set status = p_status,
         updated_at = now()
   where lease_id = p_lease_id
     and status = 'active'
  returning * into v_lease;

  if not found then
    raise exception 'Hermes lease % is not active', p_lease_id using errcode = 'P0002';
  end if;

  update public.hermes_workers
     set active_leases = greatest(active_leases - 1, 0),
         status = case
           when status = 'draining' and active_leases <= 1 then 'offline'
           when status = 'draining' then 'draining'
           when active_leases <= 1 then 'healthy'
           else 'busy'
         end,
         version_counter = version_counter + 1,
         updated_at = now()
   where worker_id = v_lease.worker_id;

  return v_lease;
end;
$$;

create or replace function public.hermes_reap_stale_leases()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease record;
  v_task public.hermes_tasks%rowtype;
  v_reaped integer := 0;
begin
  for v_lease in
    select *
      from public.hermes_worker_leases
     where status = 'active'
       and expires_at <= now()
     order by expires_at asc
     limit 500
     for update skip locked
  loop
    select *
      into v_task
      from public.hermes_tasks
     where id = v_lease.task_id
     for update;

    update public.hermes_worker_leases
       set status = 'expired',
           updated_at = now()
     where id = v_lease.id;

    update public.hermes_workers
       set active_leases = greatest(active_leases - 1, 0),
           status = case
             when status = 'draining' then 'draining'
             when active_leases <= 1 then 'healthy'
             else 'busy'
           end,
           version_counter = version_counter + 1,
           updated_at = now()
     where worker_id = v_lease.worker_id;

    if found and v_task.status in ('LOCKED', 'RUNNING') then
      update public.hermes_tasks
         set status = 'PENDING',
             retry_count = retry_count + 1,
             error_message = 'worker lease expired before terminal task transition',
             assigned_to = null,
             assigned_at = null,
             locked_at = null,
             updated_at = now()
       where id = v_task.id;
    end if;

    v_reaped := v_reaped + 1;
  end loop;

  return v_reaped;
end;
$$;

create or replace function public.hermes_reap_stale_workers(
  p_stale_seconds integer default 180
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker record;
  v_lease record;
  v_reaped integer := 0;
begin
  for v_worker in
    select *
      from public.hermes_workers
     where status in ('healthy', 'busy', 'draining')
       and last_heartbeat_at <= now() - make_interval(secs => greatest(coalesce(p_stale_seconds, 180), 60))
     order by last_heartbeat_at asc
     limit 500
     for update skip locked
  loop
    for v_lease in
      select *
        from public.hermes_worker_leases
       where worker_id = v_worker.worker_id
         and status = 'active'
       for update skip locked
    loop
      update public.hermes_worker_leases
         set status = 'expired',
             updated_at = now()
       where id = v_lease.id;

      update public.hermes_tasks
         set status = 'PENDING',
             retry_count = retry_count + 1,
             error_message = 'worker heartbeat expired before terminal task transition',
             assigned_to = null,
             assigned_at = null,
             locked_at = null,
             updated_at = now()
       where id = v_lease.task_id
         and status in ('LOCKED', 'RUNNING');
    end loop;

    update public.hermes_workers
       set status = 'lost',
           active_leases = 0,
           version_counter = version_counter + 1,
           updated_at = now()
     where worker_id = v_worker.worker_id;

    v_reaped := v_reaped + 1;
  end loop;

  return v_reaped;
end;
$$;

revoke all on function public.hermes_claim_task(text, text[], integer) from public, anon, authenticated;
revoke all on function public.hermes_worker_heartbeat(text) from public, anon, authenticated;
revoke all on function public.hermes_renew_worker_lease(text, integer) from public, anon, authenticated;
revoke all on function public.hermes_release_worker_lease(text, text) from public, anon, authenticated;
revoke all on function public.hermes_reap_stale_leases() from public, anon, authenticated;
revoke all on function public.hermes_reap_stale_workers(integer) from public, anon, authenticated;

grant execute on function public.hermes_claim_task(text, text[], integer) to service_role;
grant execute on function public.hermes_worker_heartbeat(text) to service_role;
grant execute on function public.hermes_renew_worker_lease(text, integer) to service_role;
grant execute on function public.hermes_release_worker_lease(text, text) to service_role;
grant execute on function public.hermes_reap_stale_leases() to service_role;
grant execute on function public.hermes_reap_stale_workers(integer) to service_role;

comment on function public.hermes_claim_task(text, text[], integer) is
  'Atomically locks exactly one eligible Hermes task and creates its durable worker lease. Backend service-role only.';
comment on function public.hermes_reap_stale_leases() is
  'Expires stale Hermes leases and returns associated locked or running tasks to PENDING. Backend service-role only.';
comment on function public.hermes_reap_stale_workers(integer) is
  'Marks workers with stale heartbeats lost and recovers their active leased tasks. Backend service-role only.';

commit;
