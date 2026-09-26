-- Role releases are backend-owned. Public authoring and user grants are absent.
-- Apply only after staging preview and migrate the full review workflow separately.
create table if not exists public.ai_film_role_releases (
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  role_id text not null check (role_id in ('teacher','instructor','radio_dj','host','support')),
  version integer not null check (version > 0),
  profile jsonb not null,
  profile_hash text not null check (profile_hash ~ '^[a-f0-9]{64}$'),
  reviewer_id uuid not null references auth.users(id),
  publisher_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (project_id, role_id, version),
  check (reviewer_id <> publisher_id)
);
create index if not exists ai_film_role_releases_active_idx
  on public.ai_film_role_releases(project_id, role_id, version desc) where revoked_at is null;
alter table public.ai_film_role_releases enable row level security;
revoke all on public.ai_film_role_releases from anon, authenticated;
revoke delete on public.ai_film_role_releases from service_role;
grant select, insert, update on public.ai_film_role_releases to service_role;

-- Release content is immutable; only revocation can change after insertion.
create or replace function public.ai_film_prevent_release_mutation()
returns trigger language plpgsql as $$
begin
  if old.revoked_at is not null or new.project_id is distinct from old.project_id
     or new.role_id is distinct from old.role_id or new.version is distinct from old.version
     or new.profile is distinct from old.profile or new.profile_hash is distinct from old.profile_hash
     or new.reviewer_id is distinct from old.reviewer_id or new.publisher_id is distinct from old.publisher_id
     or new.created_at is distinct from old.created_at or new.revoked_at is null then
    raise exception 'AI Film role releases are immutable except for one-time revocation';
  end if;
  return new;
end;
$$;
drop trigger if exists ai_film_role_release_immutable on public.ai_film_role_releases;
create trigger ai_film_role_release_immutable before update on public.ai_film_role_releases
for each row execute function public.ai_film_prevent_release_mutation();
