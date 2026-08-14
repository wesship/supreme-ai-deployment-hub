begin;

create table if not exists public.primetime_custom_lists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  archived_at timestamptz,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.primetime_custom_list_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  custom_list_id uuid not null references public.primetime_custom_lists(id) on delete restrict,
  person_id uuid not null references public.primetime_people(id) on delete restrict,
  added_by uuid not null,
  added_at timestamptz not null default now(),
  removed_by uuid,
  removed_at timestamptz,
  check ((removed_at is null and removed_by is null) or (removed_at is not null and removed_by is not null))
);

create unique index if not exists primetime_custom_lists_active_name_uq
  on public.primetime_custom_lists (workspace_id, lower(btrim(display_name)))
  where archived_at is null;

create unique index if not exists primetime_custom_list_members_active_uq
  on public.primetime_custom_list_members (workspace_id, custom_list_id, person_id)
  where removed_at is null;

create index if not exists primetime_custom_lists_workspace_updated_idx
  on public.primetime_custom_lists (workspace_id, updated_at desc)
  where archived_at is null;

create index if not exists primetime_custom_list_members_list_idx
  on public.primetime_custom_list_members (workspace_id, custom_list_id, added_at desc)
  where removed_at is null;

create index if not exists primetime_custom_list_members_person_idx
  on public.primetime_custom_list_members (workspace_id, person_id)
  where removed_at is null;

alter table public.primetime_custom_lists enable row level security;
alter table public.primetime_custom_list_members enable row level security;

revoke all on table public.primetime_custom_lists from anon, authenticated;
revoke all on table public.primetime_custom_list_members from anon, authenticated;
grant all on table public.primetime_custom_lists to service_role;
grant all on table public.primetime_custom_list_members to service_role;

create or replace function public.primetime_custom_list_assert_role(
  p_workspace_id uuid,
  p_actor_id uuid,
  p_allowed_roles text[]
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  select r.code into v_role
  from public.primetime_workspace_memberships m
  join public.primetime_roles r on r.id = m.role_id
  where m.workspace_id = p_workspace_id
    and m.user_id = p_actor_id
    and m.status = 'active'
  limit 1;

  if v_role is null then
    raise exception 'Workspace access required' using errcode = '42501';
  end if;

  if not (v_role = any(p_allowed_roles)) then
    raise exception 'Insufficient PRIMETIME role' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.primetime_create_custom_list(
  p_workspace_id uuid,
  p_actor_id uuid,
  p_display_name text,
  p_description text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.primetime_custom_lists%rowtype;
  v_name text := btrim(coalesce(p_display_name, ''));
  v_description text := btrim(coalesce(p_description, ''));
begin
  perform public.primetime_custom_list_assert_role(
    p_workspace_id,
    p_actor_id,
    array['representative','manager','workspace_admin']::text[]
  );

  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'Display name must contain 1 to 120 non-whitespace characters' using errcode = 'P0001';
  end if;
  if char_length(v_description) > 500 then
    raise exception 'Description must be 500 characters or fewer' using errcode = 'P0001';
  end if;

  insert into public.primetime_custom_lists(
    workspace_id, display_name, description, created_by, updated_by
  ) values (
    p_workspace_id, v_name, v_description, p_actor_id, p_actor_id
  ) returning * into v_row;

  insert into public.primetime_audit_events(
    workspace_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    p_workspace_id,
    p_actor_id,
    'crm.custom_list.created',
    'custom_list',
    v_row.id,
    jsonb_build_object('display_name', v_row.display_name)
  );

  return to_jsonb(v_row) || jsonb_build_object('record_count', 0);
end;
$$;

create or replace function public.primetime_update_custom_list(
  p_workspace_id uuid,
  p_actor_id uuid,
  p_list_id uuid,
  p_display_name text default null,
  p_description text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.primetime_custom_lists%rowtype;
  v_name text;
  v_description text;
begin
  perform public.primetime_custom_list_assert_role(
    p_workspace_id,
    p_actor_id,
    array['representative','manager','workspace_admin']::text[]
  );

  if p_display_name is null and p_description is null then
    raise exception 'At least one editable field is required' using errcode = 'P0001';
  end if;

  if p_display_name is not null then
    v_name := btrim(p_display_name);
    if char_length(v_name) < 1 or char_length(v_name) > 120 then
      raise exception 'Display name must contain 1 to 120 non-whitespace characters' using errcode = 'P0001';
    end if;
  end if;

  if p_description is not null then
    v_description := btrim(p_description);
    if char_length(v_description) > 500 then
      raise exception 'Description must be 500 characters or fewer' using errcode = 'P0001';
    end if;
  end if;

  update public.primetime_custom_lists
  set display_name = case when p_display_name is null then display_name else v_name end,
      description = case when p_description is null then description else v_description end,
      updated_by = p_actor_id,
      updated_at = now()
  where id = p_list_id
    and workspace_id = p_workspace_id
    and archived_at is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Active custom list not found' using errcode = 'P0002';
  end if;

  insert into public.primetime_audit_events(
    workspace_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    p_workspace_id,
    p_actor_id,
    'crm.custom_list.updated',
    'custom_list',
    v_row.id,
    jsonb_build_object('display_name', v_row.display_name)
  );

  return to_jsonb(v_row);
end;
$$;

create or replace function public.primetime_archive_custom_list(
  p_workspace_id uuid,
  p_actor_id uuid,
  p_list_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.primetime_custom_lists%rowtype;
begin
  perform public.primetime_custom_list_assert_role(
    p_workspace_id,
    p_actor_id,
    array['manager','workspace_admin']::text[]
  );

  update public.primetime_custom_lists
  set archived_at = now(),
      updated_at = now(),
      updated_by = p_actor_id
  where id = p_list_id
    and workspace_id = p_workspace_id
    and archived_at is null
  returning * into v_row;

  if v_row.id is null then
    select * into v_row
    from public.primetime_custom_lists
    where id = p_list_id and workspace_id = p_workspace_id
    limit 1;

    if v_row.id is null then
      raise exception 'Custom list not found' using errcode = 'P0002';
    end if;

    return to_jsonb(v_row);
  end if;

  insert into public.primetime_audit_events(
    workspace_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    p_workspace_id,
    p_actor_id,
    'crm.custom_list.archived',
    'custom_list',
    v_row.id,
    jsonb_build_object('archived_at', v_row.archived_at)
  );

  return to_jsonb(v_row);
end;
$$;

create or replace function public.primetime_add_custom_list_member(
  p_workspace_id uuid,
  p_actor_id uuid,
  p_list_id uuid,
  p_person_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.primetime_custom_list_members%rowtype;
begin
  perform public.primetime_custom_list_assert_role(
    p_workspace_id,
    p_actor_id,
    array['representative','manager','workspace_admin']::text[]
  );

  if not exists (
    select 1 from public.primetime_custom_lists
    where id = p_list_id and workspace_id = p_workspace_id and archived_at is null
  ) then
    raise exception 'Active custom list not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.primetime_people
    where id = p_person_id and workspace_id = p_workspace_id
  ) then
    raise exception 'Person not found in workspace' using errcode = 'P0002';
  end if;

  insert into public.primetime_custom_list_members(
    workspace_id, custom_list_id, person_id, added_by
  ) values (
    p_workspace_id, p_list_id, p_person_id, p_actor_id
  ) returning * into v_row;

  insert into public.primetime_audit_events(
    workspace_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    p_workspace_id,
    p_actor_id,
    'crm.custom_list.member_added',
    'custom_list_member',
    v_row.id,
    jsonb_build_object('custom_list_id', p_list_id, 'person_id', p_person_id)
  );

  return to_jsonb(v_row);
end;
$$;

create or replace function public.primetime_remove_custom_list_member(
  p_workspace_id uuid,
  p_actor_id uuid,
  p_list_id uuid,
  p_person_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.primetime_custom_list_members%rowtype;
begin
  perform public.primetime_custom_list_assert_role(
    p_workspace_id,
    p_actor_id,
    array['representative','manager','workspace_admin']::text[]
  );

  if not exists (
    select 1 from public.primetime_custom_lists
    where id = p_list_id and workspace_id = p_workspace_id and archived_at is null
  ) then
    raise exception 'Active custom list not found' using errcode = 'P0002';
  end if;

  update public.primetime_custom_list_members
  set removed_at = now(),
      removed_by = p_actor_id
  where workspace_id = p_workspace_id
    and custom_list_id = p_list_id
    and person_id = p_person_id
    and removed_at is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Active custom list membership not found' using errcode = 'P0002';
  end if;

  insert into public.primetime_audit_events(
    workspace_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    p_workspace_id,
    p_actor_id,
    'crm.custom_list.member_removed',
    'custom_list_member',
    v_row.id,
    jsonb_build_object('custom_list_id', p_list_id, 'person_id', p_person_id)
  );

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.primetime_custom_list_assert_role(uuid, uuid, text[]) from public, anon, authenticated;
revoke all on function public.primetime_create_custom_list(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.primetime_update_custom_list(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.primetime_archive_custom_list(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.primetime_add_custom_list_member(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.primetime_remove_custom_list_member(uuid, uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function public.primetime_custom_list_assert_role(uuid, uuid, text[]) to service_role;
grant execute on function public.primetime_create_custom_list(uuid, uuid, text, text) to service_role;
grant execute on function public.primetime_update_custom_list(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.primetime_archive_custom_list(uuid, uuid, uuid) to service_role;
grant execute on function public.primetime_add_custom_list_member(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.primetime_remove_custom_list_member(uuid, uuid, uuid, uuid) to service_role;

comment on table public.primetime_custom_lists is
  'Workspace-scoped PRIMETIME CRM custom lists. Governed mutations use service-role-only atomic RPCs.';
comment on table public.primetime_custom_list_members is
  'Soft-removable membership links between governed custom lists and PRIMETIME people.';

commit;
