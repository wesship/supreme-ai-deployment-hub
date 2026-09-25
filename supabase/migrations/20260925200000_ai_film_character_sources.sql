-- Submitted source snapshots are immutable. A separate reviewer approves before retrieval.
create table public.ai_film_character_sources (
  id uuid primary key,
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 160),
  content text not null check (length(btrim(content)) between 1 and 12000),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  rights_basis text not null check (length(btrim(rights_basis)) between 1 and 500),
  status text not null default 'draft' check (status in ('draft','approved','revoked')),
  created_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  revoked_at timestamptz,
  unique (project_id, id),
  check ((status = 'draft' and approved_by is null and approved_at is null and revoked_at is null)
      or (status = 'approved' and approved_by is not null and approved_at is not null and revoked_at is null)
      or (status = 'revoked' and revoked_at is not null)),
  check (approved_by is null or approved_by <> created_by)
);
create index ai_film_character_sources_project_idx
  on public.ai_film_character_sources(project_id, created_at desc, id);
alter table public.ai_film_character_sources enable row level security;
revoke all on public.ai_film_character_sources from anon, authenticated;
revoke delete on public.ai_film_character_sources from service_role;
grant select, insert, update on public.ai_film_character_sources to service_role;

create or replace function public.ai_film_protect_character_source()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.id is distinct from old.id or new.project_id is distinct from old.project_id
     or new.title is distinct from old.title or new.content is distinct from old.content
     or new.content_hash is distinct from old.content_hash or new.rights_basis is distinct from old.rights_basis
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at
     or (old.status = 'draft' and (new.status <> 'approved' or new.approved_by is null
         or new.approved_by = old.created_by or new.approved_at is null or new.revoked_at is not null))
     or (old.status = 'approved' and (new.status <> 'revoked' or new.approved_by is distinct from old.approved_by
         or new.approved_at is distinct from old.approved_at or new.revoked_at is null))
     or old.status = 'revoked' then
    raise exception 'Invalid character source transition';
  end if;
  return new;
end;
$$;
create trigger ai_film_character_source_immutable before update on public.ai_film_character_sources
for each row execute function public.ai_film_protect_character_source();

create or replace function public.ai_film_character_source_advance(
  p_action text, p_project_id uuid, p_source_id uuid, p_actor_id uuid
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  s public.ai_film_character_sources%rowtype;
  project_owner uuid;
  reviewer boolean;
begin
  select * into s from public.ai_film_character_sources
    where id = p_source_id and project_id = p_project_id for update;
  if s.id is null then raise exception 'Source unavailable'; end if;
  select owner_id into project_owner from public.ai_film_projects where id = p_project_id;
  reviewer := p_actor_id = project_owner or exists (
    select 1 from public.ai_film_collaborators
      where project_id = p_project_id and user_id = p_actor_id and status = 'active'
        and role in ('producer','director','reviewer'));
  if p_action = 'approve' then
    if not reviewer or p_actor_id = s.created_by or s.status <> 'draft' then
      raise exception 'Independent source review required' using errcode='42501';
    end if;
    update public.ai_film_character_sources set status='approved', approved_by=p_actor_id,
      approved_at=now() where id=s.id;
  elsif p_action = 'revoke' then
    if p_actor_id <> project_owner or s.status <> 'approved' then
      raise exception 'Project owner revocation required' using errcode='42501';
    end if;
    update public.ai_film_character_sources set status='revoked', revoked_at=now() where id=s.id;
  else
    raise exception 'Unknown source transition';
  end if;
  return jsonb_build_object('id',s.id,'status',case when p_action='approve' then 'approved' else 'revoked' end);
end;
$$;
revoke all on function public.ai_film_character_source_advance(text,uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.ai_film_character_source_advance(text,uuid,uuid,uuid)
  to service_role;
