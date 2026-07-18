\set ON_ERROR_STOP on

insert into public.roles(id, name) values
  ('10000000-0000-0000-0000-000000000001', 'representative'),
  ('10000000-0000-0000-0000-000000000002', 'auditor');

insert into public.workspaces(id) values
  ('20000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002');

insert into public.users(id) values
  ('30000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000003');

insert into public.workspace_memberships(workspace_id, user_id, role_id, status) values
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'active'),
  ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'active'),
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'inactive');

insert into public.appointments(
  id, workspace_id, owner_id, title, status, starts_at, ends_at, created_by
) values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Workspace A appointment', 'scheduled', now() + interval '1 day', now() + interval '2 days', '30000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'Workspace B appointment', 'scheduled', now() + interval '1 day', now() + interval '2 days', '30000000-0000-0000-0000-000000000002');

-- Appointment controls reject blocked scheduling.
do $$
begin
  begin
    insert into public.appointments(workspace_id, owner_id, title, status, starts_at, ends_at, compliance_status)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Blocked', 'scheduled', now(), now() + interval '1 hour', 'blocked');
    raise exception 'blocked appointment was accepted';
  exception when others then
    if sqlerrm = 'blocked appointment was accepted' then raise; end if;
  end;
end $$;

set role primetime_app;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', false);

-- Active member can see own workspace only.
do $$
declare c integer;
begin
  select count(*) into c from public.appointments;
  if c <> 1 then raise exception 'expected one visible appointment for workspace A, got %', c; end if;
end $$;

-- Cross-workspace reads are denied by RLS.
do $$
declare c integer;
begin
  select count(*) into c from public.appointments where workspace_id = '20000000-0000-0000-0000-000000000002';
  if c <> 0 then raise exception 'cross-workspace read was allowed'; end if;
end $$;

-- Cross-workspace writes are denied by WITH CHECK.
do $$
begin
  begin
    insert into public.appointments(workspace_id, owner_id, title, status, starts_at, ends_at)
    values ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Forbidden', 'scheduled', now(), now() + interval '1 hour');
    raise exception 'cross-workspace write was allowed';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- Own-workspace write succeeds.
insert into public.appointments(workspace_id, owner_id, title, status, starts_at, ends_at)
values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Allowed', 'scheduled', now(), now() + interval '1 hour');

reset role;

-- Audit persistence is explicit and tenant-bound.
insert into public.audit_events(workspace_id, actor_id, action, entity_type, entity_id, metadata)
values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'appointment.create', 'appointment', '40000000-0000-0000-0000-000000000001', '{"source":"integration-test"}');

do $$
declare c integer;
begin
  select count(*) into c from public.audit_events
  where workspace_id = '20000000-0000-0000-0000-000000000001'
    and action = 'appointment.create'
    and metadata->>'source' = 'integration-test';
  if c <> 1 then raise exception 'audit event was not persisted'; end if;
end $$;

-- Inactive membership must not grant access.
set role primetime_app;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', false);
do $$
declare c integer;
begin
  select count(*) into c from public.appointments;
  if c <> 0 then raise exception 'inactive member retained RLS access'; end if;
end $$;
reset role;

-- Role fixture integrity for API role enforcement.
do $$
declare role_name text;
begin
  select r.name into role_name
  from public.workspace_memberships wm
  join public.roles r on r.id = wm.role_id
  where wm.workspace_id = '20000000-0000-0000-0000-000000000001'
    and wm.user_id = '30000000-0000-0000-0000-000000000001';
  if role_name <> 'representative' then raise exception 'role resolution failed'; end if;
end $$;
