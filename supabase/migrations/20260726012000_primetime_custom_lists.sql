begin;

create table if not exists public.primetime_custom_lists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id),
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
  workspace_id uuid not null references public.primetime_workspaces(id),
  custom_list_id uuid not null references public.primetime_custom_lists(id),
  person_id uuid not null references public.primetime_people(id),
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

comment on table public.primetime_custom_lists is
  'Workspace-scoped PRIMETIME CRM custom lists. Writes occur only through the governed API boundary.';
comment on table public.primetime_custom_list_members is
  'Soft-removable membership links between governed custom lists and PRIMETIME people.';
comment on column public.primetime_custom_lists.archived_at is
  'Soft archive timestamp. Hard deletion is not part of the governed API contract.';
comment on column public.primetime_custom_list_members.removed_at is
  'Soft removal timestamp. Active record counts derive from rows where removed_at is null.';

commit;
