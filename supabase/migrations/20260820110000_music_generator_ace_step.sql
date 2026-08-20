-- D3VONN Music Studio foundation
--
-- The provider catalog is deliberately license-aware. A provider may be technically
-- configured while still blocked from hosted/commercial dispatch until its policy
-- review is approved. Secrets and endpoint URLs belong in function secrets, never
-- in this schema.

create table if not exists public.music_provider_profiles (
  provider_key text primary key,
  display_name text not null,
  adapter_key text not null,
  default_model text not null,
  default_model_version text,
  priority integer not null default 100 check (priority between 1 and 10000),
  enabled boolean not null default true,
  technical_status text not null default 'unknown' check (technical_status in ('unknown', 'configured', 'healthy', 'degraded', 'offline')),
  license_name text not null,
  license_source_url text,
  license_review_status text not null default 'pending' check (license_review_status in ('pending', 'approved', 'restricted', 'rejected', 'expired')),
  commercial_allowed boolean not null default false,
  hosted_allowed boolean not null default false,
  output_commercial_allowed boolean not null default false,
  attribution_requirements jsonb not null default '[]'::jsonb,
  provenance_requirements jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(provider_key)) > 0),
  check (length(trim(adapter_key)) > 0)
);

-- ACE-Step integration remains available for engineering and local validation, but
-- dispatch is denied by the Edge Function until a named reviewer explicitly changes
-- the policy status and the three hosted/commercial flags to approved values.
insert into public.music_provider_profiles (
  provider_key,
  display_name,
  adapter_key,
  default_model,
  default_model_version,
  priority,
  enabled,
  technical_status,
  license_name,
  license_source_url,
  license_review_status,
  commercial_allowed,
  hosted_allowed,
  output_commercial_allowed,
  attribution_requirements,
  provenance_requirements,
  notes
) values (
  'ace-step-1.5',
  'ACE-Step 1.5',
  'ace_step_async',
  'acestep-v15-turbo',
  '1.5',
  100,
  true,
  'unknown',
  'MIT — policy review pending',
  'https://github.com/ace-step/ACE-Step-1.5/blob/main/LICENSE',
  'pending',
  false,
  false,
  false,
  '["Retain the MIT notice when redistributing applicable software or model materials."]'::jsonb,
  '{"ai_disclosure_recommended": true, "retain_prompt_and_model_version": true, "retain_license_snapshot": true}'::jsonb,
  'Technical adapter is prepared. Hosted and commercial dispatch are intentionally blocked until legal and product owners approve the complete deployment posture.'
) on conflict (provider_key) do nothing;

create table if not exists public.music_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_key text not null references public.music_provider_profiles(provider_key),
  provider_task_id text,
  provider_display_name text not null,
  model_name text not null,
  model_version text,
  status text not null default 'queued' check (status in ('queued', 'provisioning', 'running', 'post_processing', 'uploading', 'succeeded', 'failed', 'cancelled', 'retrying')),
  title text not null default 'Untitled generation',
  prompt text not null,
  lyrics text not null default '',
  genre text,
  bpm integer check (bpm between 40 and 240),
  key_signature text,
  duration_seconds integer not null check (duration_seconds between 10 and 600),
  vocal_language text not null default 'en',
  instrumental boolean not null default false,
  seed bigint,
  parameters jsonb not null default '{}'::jsonb,
  idempotency_key text,
  request_fingerprint text,
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  max_attempts integer not null default 3 check (max_attempts between 1 and 20),
  original_audio_path text,
  processed_audio_path text,
  audio_url text,
  artwork_path text,
  audio_bytes bigint check (audio_bytes is null or audio_bytes >= 0),
  audio_metadata jsonb not null default '{}'::jsonb,
  qa_result jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  license_snapshot jsonb not null default '{}'::jsonb,
  failure_reason text,
  error_message text,
  last_provider_latency_ms integer check (last_provider_latency_ms is null or last_provider_latency_ms >= 0),
  queued_at timestamptz not null default now(),
  provisioning_at timestamptz,
  started_at timestamptz,
  post_processing_at timestamptz,
  uploading_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  check (instrumental or length(vocal_language) > 0)
);

create index if not exists music_generation_jobs_user_created_idx on public.music_generation_jobs (user_id, created_at desc);
create index if not exists music_generation_jobs_user_status_idx on public.music_generation_jobs (user_id, status, created_at desc);
create index if not exists music_generation_jobs_provider_task_idx on public.music_generation_jobs (provider_key, provider_task_id) where provider_task_id is not null;
create index if not exists music_generation_jobs_active_idx on public.music_generation_jobs (status, queued_at asc) where status in ('queued', 'provisioning', 'running', 'post_processing', 'uploading', 'retrying');

create table if not exists public.music_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.music_generation_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists music_job_events_job_created_idx on public.music_job_events (job_id, created_at asc);
create index if not exists music_job_events_user_created_idx on public.music_job_events (user_id, created_at desc);

create table if not exists public.music_provider_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null references public.music_provider_profiles(provider_key) on delete cascade,
  status text not null check (status in ('healthy', 'degraded', 'offline', 'unknown')),
  gpu_online boolean,
  gpu_name text,
  vram_total_mb integer check (vram_total_mb is null or vram_total_mb >= 0),
  vram_free_mb integer check (vram_free_mb is null or vram_free_mb >= 0),
  model_loaded boolean,
  api_latency_ms integer check (api_latency_ms is null or api_latency_ms >= 0),
  queue_depth integer check (queue_depth is null or queue_depth >= 0),
  supported_duration_seconds integer,
  provider_version text,
  last_successful_generation_at timestamptz,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create index if not exists music_provider_health_snapshots_latest_idx on public.music_provider_health_snapshots (provider_key, checked_at desc);

create table if not exists public.music_safety_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.music_generation_jobs(id) on delete set null,
  event_type text not null,
  reason text,
  request_fingerprint text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists music_safety_events_user_created_idx on public.music_safety_events (user_id, created_at desc);

alter table public.music_provider_profiles enable row level security;
alter table public.music_generation_jobs enable row level security;
alter table public.music_job_events enable row level security;
alter table public.music_provider_health_snapshots enable row level security;
alter table public.music_safety_events enable row level security;

-- All mutation happens via the authenticated Edge Function using the service role.
-- Users can inspect only their own job data and lifecycle events.
drop policy if exists "music jobs are readable by owner" on public.music_generation_jobs;
drop policy if exists "music jobs are insertable by owner" on public.music_generation_jobs;
drop policy if exists "music jobs are updatable by owner" on public.music_generation_jobs;
create policy "music jobs are readable by owner"
  on public.music_generation_jobs for select using (auth.uid() = user_id);
create policy "music job events are readable by owner"
  on public.music_job_events for select using (auth.uid() = user_id);

create or replace function public.set_music_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.enforce_music_generation_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'queued' and new.status in ('provisioning', 'cancelled', 'failed'))
    or (old.status = 'provisioning' and new.status in ('running', 'retrying', 'failed', 'cancelled'))
    or (old.status = 'running' and new.status in ('post_processing', 'retrying', 'failed', 'cancelled'))
    or (old.status = 'post_processing' and new.status in ('uploading', 'retrying', 'failed', 'cancelled'))
    or (old.status = 'uploading' and new.status in ('succeeded', 'retrying', 'failed', 'cancelled'))
    or (old.status = 'failed' and new.status = 'retrying')
    or (old.status = 'retrying' and new.status in ('provisioning', 'failed', 'cancelled'))
  ) then
    raise exception 'Invalid music job status transition from % to %', old.status, new.status;
  end if;

  if new.status = 'provisioning' and new.provisioning_at is null then
    new.provisioning_at = now();
  elsif new.status = 'running' and new.started_at is null then
    new.started_at = now();
  elsif new.status = 'post_processing' and new.post_processing_at is null then
    new.post_processing_at = now();
  elsif new.status = 'uploading' and new.uploading_at is null then
    new.uploading_at = now();
  elsif new.status = 'succeeded' and new.completed_at is null then
    new.completed_at = now();
  elsif new.status = 'cancelled' and new.cancelled_at is null then
    new.cancelled_at = now();
  end if;

  return new;
end;
$$;

create or replace function public.log_music_generation_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.music_job_events (job_id, user_id, event_type, to_status, message, metadata)
    values (
      new.id,
      new.user_id,
      'job_created',
      new.status,
      'Music generation job created.',
      jsonb_build_object('provider_key', new.provider_key, 'model_name', new.model_name, 'model_version', new.model_version)
    );
  elsif new.status is distinct from old.status then
    insert into public.music_job_events (job_id, user_id, event_type, from_status, to_status, message, metadata)
    values (
      new.id,
      new.user_id,
      'status_changed',
      old.status,
      new.status,
      format('Music job moved from %s to %s.', old.status, new.status),
      jsonb_build_object('provider_key', new.provider_key, 'provider_task_id', new.provider_task_id, 'attempt_count', new.attempt_count)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists music_provider_profiles_updated_at on public.music_provider_profiles;
create trigger music_provider_profiles_updated_at
  before update on public.music_provider_profiles
  for each row execute function public.set_music_updated_at();

drop trigger if exists music_generation_jobs_updated_at on public.music_generation_jobs;
create trigger music_generation_jobs_updated_at
  before update on public.music_generation_jobs
  for each row execute function public.set_music_updated_at();

drop trigger if exists music_generation_jobs_transition_guard on public.music_generation_jobs;
create trigger music_generation_jobs_transition_guard
  before update of status on public.music_generation_jobs
  for each row execute function public.enforce_music_generation_transition();

drop trigger if exists music_generation_jobs_transition_log on public.music_generation_jobs;
create trigger music_generation_jobs_transition_log
  after insert or update of status on public.music_generation_jobs
  for each row execute function public.log_music_generation_transition();

-- Atomically claim waiting work. It is invoked only by the service-role worker
-- and uses SKIP LOCKED so overlapping worker cycles cannot submit a job twice.
create or replace function public.music_claim_generation_jobs(p_limit integer default 5)
returns setof public.music_generation_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select id
    from public.music_generation_jobs
    where status in ('queued', 'retrying')
    order by queued_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 5), 25))
  )
  update public.music_generation_jobs jobs
  set
    status = 'provisioning',
    attempt_count = jobs.attempt_count + 1,
    error_message = null
  from candidates
  where jobs.id = candidates.id
  returning jobs.*;
end;
$$;

revoke all on function public.music_claim_generation_jobs(integer) from public, anon, authenticated;
grant execute on function public.music_claim_generation_jobs(integer) to service_role;

-- The private bucket preserves originals, mastered copies, provenance JSON, and
-- optional artwork under the owning user UUID. The client receives signed URLs only.
insert into storage.buckets (id, name, public)
values ('music-library', 'music-library', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "music files are readable by owner" on storage.objects;
drop policy if exists "music files are writable by owner" on storage.objects;
drop policy if exists "music files are deletable by owner" on storage.objects;
create policy "music files are readable by owner"
  on storage.objects for select
  using (bucket_id = 'music-library' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "music files are deletable by owner"
  on storage.objects for delete
  using (bucket_id = 'music-library' and auth.uid()::text = (storage.foldername(name))[1]);

create or replace view public.music_library
with (security_invoker = true)
as
select
  id,
  user_id,
  title,
  prompt,
  lyrics,
  genre,
  bpm,
  key_signature,
  duration_seconds,
  vocal_language,
  instrumental,
  provider_key,
  provider_display_name,
  model_name,
  model_version,
  seed,
  original_audio_path,
  processed_audio_path,
  artwork_path,
  audio_metadata,
  qa_result,
  provenance,
  license_snapshot,
  completed_at,
  created_at
from public.music_generation_jobs
where status = 'succeeded';

grant select on public.music_generation_jobs, public.music_job_events, public.music_provider_health_snapshots, public.music_library to authenticated;
revoke all on public.music_provider_profiles, public.music_safety_events from anon, authenticated;
