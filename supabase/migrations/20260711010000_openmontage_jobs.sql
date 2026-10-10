create table if not exists public.openmontage_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  deployed_agent_id uuid references public.deployed_agents(id) on delete set null,
  agent_slug text not null default 'openmontage-video-intelligence-studio',
  idea text,
  screenplay text not null,
  video_prompt text,
  provider text,
  provider_job_id text,
  video_url text,
  status text not null default 'queued' check (status in ('queued','research','script','storyboard','assets','narration','render','review','publish','completed','failed')),
  stages jsonb not null default '[]'::jsonb,
  error jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists openmontage_jobs_user_created_idx
  on public.openmontage_jobs(user_id, created_at desc);
create index if not exists openmontage_jobs_status_idx
  on public.openmontage_jobs(status);

alter table public.openmontage_jobs enable row level security;

create policy "Users can read their OpenMontage jobs"
  on public.openmontage_jobs for select
  using (auth.uid() = user_id);

create policy "Users can create their OpenMontage jobs"
  on public.openmontage_jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their OpenMontage jobs"
  on public.openmontage_jobs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_openmontage_job_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_openmontage_job_updated_at on public.openmontage_jobs;
create trigger set_openmontage_job_updated_at
before update on public.openmontage_jobs
for each row execute function public.set_openmontage_job_updated_at();
