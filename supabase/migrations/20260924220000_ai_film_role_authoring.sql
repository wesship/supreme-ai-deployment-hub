-- Service-role-only role authoring. Every transition is atomic and actor-checked.
create table if not exists public.ai_film_role_drafts (
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
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
  primary key (project_id, role_id)
);
alter table public.ai_film_role_drafts enable row level security;
revoke all on public.ai_film_role_drafts from anon, authenticated;
grant select, insert, update on public.ai_film_role_drafts to service_role;

create or replace function public.ai_film_role_advance(
  p_action text, p_project_id uuid, p_role_id text, p_actor_id uuid,
  p_expected_revision integer, p_profile jsonb, p_profile_hash text, p_test_run_id text
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  d public.ai_film_role_drafts%rowtype;
  project_owner uuid;
  collaborator_role text;
  allowed_editor boolean;
  allowed_reviewer boolean;
  allowed_publisher boolean;
  new_version integer;
begin
  if p_role_id not in ('teacher','instructor','radio_dj','host','support')
     or p_actor_id is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid role transition request';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text || ':' || p_role_id, 0));
  select owner_id into project_owner from public.ai_film_projects where id = p_project_id;
  if project_owner is null then raise exception 'Project not found'; end if;
  select role into collaborator_role from public.ai_film_collaborators
    where project_id=p_project_id and user_id=p_actor_id and status='active'
      and role in ('producer','director','writer','editor','reviewer')
    order by accepted_at desc nulls last limit 1;
  allowed_editor := p_actor_id = project_owner or collaborator_role in ('producer','director','writer','editor');
  allowed_reviewer := p_actor_id = project_owner or collaborator_role in ('producer','director','reviewer');
  allowed_publisher := p_actor_id = project_owner or collaborator_role in ('producer','director');
  select * into d from public.ai_film_role_drafts
    where project_id=p_project_id and role_id=p_role_id for update;

  if p_action = 'save' then
    if not allowed_editor then raise exception 'Editor access required' using errcode='42501'; end if;
    if (d.project_id is null and p_expected_revision <> 0)
       or (d.project_id is not null and d.revision <> p_expected_revision) then
      raise exception 'Stale draft revision';
    end if;
    if p_profile is null or jsonb_typeof(p_profile) <> 'object'
       or p_profile_hash !~ '^[a-f0-9]{64}$' then
      raise exception 'Invalid profile';
    end if;
    insert into public.ai_film_role_drafts
      (project_id,role_id,revision,profile,profile_hash,editor_id,status)
      values (p_project_id,p_role_id,p_expected_revision+1,p_profile,p_profile_hash,p_actor_id,'draft')
      on conflict (project_id,role_id) do update set
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
    update public.ai_film_role_drafts set tested_hash=d.profile_hash,
      test_run_id=p_test_run_id,updated_at=now()
      where project_id=p_project_id and role_id=p_role_id;
    return jsonb_build_object('status','tested','revision',d.revision);
  elsif p_action = 'submit' then
    if not allowed_editor or d.status <> 'draft' or d.tested_hash is distinct from d.profile_hash then
      raise exception 'Current tested draft required';
    end if;
    update public.ai_film_role_drafts set status='review',updated_at=now()
      where project_id=p_project_id and role_id=p_role_id;
    return jsonb_build_object('status','review','revision',d.revision);
  elsif p_action = 'approve' then
    if not allowed_reviewer or p_actor_id = d.editor_id or d.status <> 'review'
       or d.tested_hash is distinct from d.profile_hash then
      raise exception 'Independent review required';
    end if;
    update public.ai_film_role_drafts set status='approved',reviewer_id=p_actor_id,
      approved_hash=d.profile_hash,updated_at=now()
      where project_id=p_project_id and role_id=p_role_id;
    return jsonb_build_object('status','approved','revision',d.revision);
  elsif p_action = 'publish' then
    if not allowed_publisher or p_actor_id in (d.editor_id,d.reviewer_id)
       or d.status <> 'approved' or d.approved_hash is distinct from d.profile_hash then
      raise exception 'Independent approved release required';
    end if;
    new_version := d.published_version + 1;
    insert into public.ai_film_role_releases
      (project_id,role_id,version,profile,profile_hash,reviewer_id,publisher_id)
      values (p_project_id,p_role_id,new_version,d.profile,d.profile_hash,d.reviewer_id,p_actor_id);
    update public.ai_film_role_drafts set status='published',published_version=new_version,updated_at=now()
      where project_id=p_project_id and role_id=p_role_id;
    return jsonb_build_object('status','published','revision',d.revision,'version',new_version);
  end if;
  raise exception 'Unknown role transition';
end;
$$;
revoke all on function public.ai_film_role_advance(text,uuid,text,uuid,integer,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.ai_film_role_advance(text,uuid,text,uuid,integer,jsonb,text,text) to service_role;
