-- Characters are project-scoped identities; roles and releases are per character.
create table if not exists public.ai_film_characters (
  id uuid primary key,
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name text not null check (length(btrim(name)) between 1 and 100),
  description text not null default '' check (length(description) <= 1000),
  avatar_version text not null check (length(btrim(avatar_version)) between 1 and 160),
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, slug),
  unique (project_id, id)
);
create index if not exists ai_film_characters_project_idx on public.ai_film_characters(project_id, created_at, id);
alter table public.ai_film_characters enable row level security;
revoke all on public.ai_film_characters from anon, authenticated;
grant select, insert, update on public.ai_film_characters to service_role;

create or replace function public.ai_film_protect_character_identity()
returns trigger language plpgsql as $$
begin
  if new.id is distinct from old.id or new.project_id is distinct from old.project_id
     or new.slug is distinct from old.slug or new.avatar_version is distinct from old.avatar_version
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at
     or (old.status = 'archived' and new.status <> 'archived') then
    raise exception 'Character identity is immutable';
  end if;
  return new;
end;
$$;
create trigger ai_film_character_identity_immutable before update on public.ai_film_characters
for each row execute function public.ai_film_protect_character_identity();

create table if not exists public.ai_film_character_role_drafts (
  project_id uuid not null,
  character_id uuid not null,
  role_id text not null check (role_id in ('teacher','instructor','radio_dj','host','support')),
  revision integer not null check (revision > 0),
  profile jsonb not null,
  profile_hash text not null check (profile_hash ~ '^[a-f0-9]{64}$'),
  editor_id uuid not null references auth.users(id),
  tested_hash text,
  test_run_id text,
  status text not null check (status in ('draft','review','approved','published')),
  reviewer_id uuid references auth.users(id),
  approved_hash text,
  published_version integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (project_id, character_id, role_id),
  foreign key (project_id, character_id) references public.ai_film_characters(project_id, id)
);
alter table public.ai_film_character_role_drafts enable row level security;
revoke all on public.ai_film_character_role_drafts from anon, authenticated;
grant select, insert, update on public.ai_film_character_role_drafts to service_role;

create table if not exists public.ai_film_character_role_releases (
  project_id uuid not null,
  character_id uuid not null,
  role_id text not null check (role_id in ('teacher','instructor','radio_dj','host','support')),
  version integer not null check (version > 0),
  profile jsonb not null,
  profile_hash text not null check (profile_hash ~ '^[a-f0-9]{64}$'),
  reviewer_id uuid not null references auth.users(id),
  publisher_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (project_id, character_id, role_id, version),
  foreign key (project_id, character_id) references public.ai_film_characters(project_id, id),
  check (reviewer_id <> publisher_id)
);
create index if not exists ai_film_character_role_releases_active_idx
  on public.ai_film_character_role_releases(project_id, character_id, role_id, version desc)
  where revoked_at is null;
alter table public.ai_film_character_role_releases enable row level security;
revoke all on public.ai_film_character_role_releases from anon, authenticated;
revoke delete on public.ai_film_character_role_releases from service_role;
grant select, insert, update on public.ai_film_character_role_releases to service_role;

create or replace function public.ai_film_prevent_character_release_mutation()
returns trigger language plpgsql as $$
begin
  if old.revoked_at is not null or new.project_id is distinct from old.project_id
     or new.character_id is distinct from old.character_id
     or new.role_id is distinct from old.role_id or new.version is distinct from old.version
     or new.profile is distinct from old.profile or new.profile_hash is distinct from old.profile_hash
     or new.reviewer_id is distinct from old.reviewer_id or new.publisher_id is distinct from old.publisher_id
     or new.created_at is distinct from old.created_at or new.revoked_at is null then
    raise exception 'AI Film character role releases are immutable except for one-time revocation';
  end if;
  return new;
end;
$$;
create trigger ai_film_character_release_immutable before update on public.ai_film_character_role_releases
for each row execute function public.ai_film_prevent_character_release_mutation();

create or replace function public.ai_film_character_role_advance(
  p_action text, p_project_id uuid, p_character_id uuid, p_role_id text, p_actor_id uuid,
  p_expected_revision integer, p_profile jsonb, p_profile_hash text, p_test_run_id text
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  d public.ai_film_character_role_drafts%rowtype;
  project_owner uuid;
  collaborator_role text;
  allowed_editor boolean;
  allowed_reviewer boolean;
  allowed_publisher boolean;
  new_version integer;
begin
  if p_character_id is null or p_role_id not in ('teacher','instructor','radio_dj','host','support')
     or p_actor_id is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid role transition request';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text || ':' || p_character_id::text || ':' || p_role_id, 0));
  select owner_id into project_owner from public.ai_film_projects where id = p_project_id;
  if project_owner is null then raise exception 'Project not found'; end if;
  if not exists (select 1 from public.ai_film_characters where id=p_character_id and project_id=p_project_id and status='active') then
    raise exception 'Active character not found';
  end if;
  select role into collaborator_role from public.ai_film_collaborators
    where project_id=p_project_id and user_id=p_actor_id and status='active'
      and role in ('producer','director','writer','editor','reviewer')
    order by accepted_at desc nulls last limit 1;
  allowed_editor := p_actor_id = project_owner or collaborator_role in ('producer','director','writer','editor');
  allowed_reviewer := p_actor_id = project_owner or collaborator_role in ('producer','director','reviewer');
  allowed_publisher := p_actor_id = project_owner or collaborator_role in ('producer','director');
  select * into d from public.ai_film_character_role_drafts
    where project_id=p_project_id and character_id=p_character_id and role_id=p_role_id for update;

  if p_action = 'save' then
    if not allowed_editor then raise exception 'Editor access required' using errcode='42501'; end if;
    if (d.project_id is null and p_expected_revision <> 0)
       or (d.project_id is not null and d.revision <> p_expected_revision) then
      raise exception 'Stale draft revision';
    end if;
    if p_profile is null or jsonb_typeof(p_profile) <> 'object'
       or p_profile_hash !~ '^[a-f0-9]{64}$'
       or p_profile->>'avatar_version' is distinct from
          (select avatar_version from public.ai_film_characters where id=p_character_id and project_id=p_project_id) then
      raise exception 'Invalid profile';
    end if;
    insert into public.ai_film_character_role_drafts
      (project_id,character_id,role_id,revision,profile,profile_hash,editor_id,status)
      values (p_project_id,p_character_id,p_role_id,p_expected_revision+1,p_profile,p_profile_hash,p_actor_id,'draft')
      on conflict (project_id,character_id,role_id) do update set
      revision=excluded.revision,profile=excluded.profile,profile_hash=excluded.profile_hash,
      editor_id=excluded.editor_id,tested_hash=null,test_run_id=null,status='draft',
      reviewer_id=null,approved_hash=null,updated_at=now();
    return jsonb_build_object('status','draft','revision',p_expected_revision+1);
  end if;

  if d.project_id is null or d.revision <> p_expected_revision then
    raise exception 'Draft not found or stale revision';
  end if;
  if p_action = 'test' then
    if not allowed_editor or d.status <> 'draft'
       or p_profile_hash is distinct from d.profile_hash
       or nullif(p_test_run_id,'') is null then
      raise exception 'Current draft policy test required';
    end if;
    update public.ai_film_character_role_drafts set tested_hash=d.profile_hash,
      test_run_id=p_test_run_id,updated_at=now()
      where project_id=p_project_id and character_id=p_character_id and role_id=p_role_id;
    return jsonb_build_object('status','tested','revision',d.revision);
  elsif p_action = 'submit' then
    if not allowed_editor or d.status <> 'draft' or d.tested_hash is distinct from d.profile_hash then
      raise exception 'Current tested draft required';
    end if;
    update public.ai_film_character_role_drafts set status='review',updated_at=now()
      where project_id=p_project_id and character_id=p_character_id and role_id=p_role_id;
    return jsonb_build_object('status','review','revision',d.revision);
  elsif p_action = 'approve' then
    if not allowed_reviewer or p_actor_id = d.editor_id or d.status <> 'review'
       or d.tested_hash is distinct from d.profile_hash then
      raise exception 'Independent review required';
    end if;
    update public.ai_film_character_role_drafts set status='approved',reviewer_id=p_actor_id,
      approved_hash=d.profile_hash,updated_at=now()
      where project_id=p_project_id and character_id=p_character_id and role_id=p_role_id;
    return jsonb_build_object('status','approved','revision',d.revision);
  elsif p_action = 'publish' then
    if not allowed_publisher or p_actor_id in (d.editor_id,d.reviewer_id)
       or d.status <> 'approved' or d.approved_hash is distinct from d.profile_hash then
      raise exception 'Independent approved release required';
    end if;
    new_version := d.published_version + 1;
    insert into public.ai_film_character_role_releases
      (project_id,character_id,role_id,version,profile,profile_hash,reviewer_id,publisher_id)
      values (p_project_id,p_character_id,p_role_id,new_version,d.profile,d.profile_hash,d.reviewer_id,p_actor_id);
    update public.ai_film_character_role_drafts set status='published',published_version=new_version,updated_at=now()
      where project_id=p_project_id and character_id=p_character_id and role_id=p_role_id;
    return jsonb_build_object('status','published','revision',d.revision,'version',new_version);
  end if;
  raise exception 'Unknown role transition';
end;
$$;
revoke all on function public.ai_film_character_role_advance(text,uuid,uuid,text,uuid,integer,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.ai_film_character_role_advance(text,uuid,uuid,text,uuid,integer,jsonb,text,text) to service_role;
