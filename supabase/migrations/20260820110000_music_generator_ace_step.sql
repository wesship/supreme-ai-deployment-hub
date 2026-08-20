create table if not exists public.music_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'ace-step-1.5',
  provider_task_id text,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  prompt text not null,
  lyrics text not null default '',
  parameters jsonb not null default '{}'::jsonb,
  audio_path text,
  audio_url text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists music_generation_jobs_user_created_idx on public.music_generation_jobs (user_id, created_at desc);
create unique index if not exists music_generation_jobs_provider_task_idx on public.music_generation_jobs (provider, provider_task_id) where provider_task_id is not null;
alter table public.music_generation_jobs enable row level security;
create policy "music jobs are readable by owner" on public.music_generation_jobs for select using (auth.uid() = user_id);
create policy "music jobs are insertable by owner" on public.music_generation_jobs for insert with check (auth.uid() = user_id);
create policy "music jobs are updatable by owner" on public.music_generation_jobs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
insert into storage.buckets (id, name, public) values ('music-library', 'music-library', false) on conflict (id) do update set public = excluded.public;
create policy "music files are readable by owner" on storage.objects for select using (bucket_id = 'music-library' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "music files are writable by owner" on storage.objects for insert with check (bucket_id = 'music-library' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "music files are deletable by owner" on storage.objects for delete using (bucket_id = 'music-library' and auth.uid()::text = (storage.foldername(name))[1]);
create or replace function public.set_music_generation_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists music_generation_jobs_updated_at on public.music_generation_jobs;
create trigger music_generation_jobs_updated_at before update on public.music_generation_jobs for each row execute function public.set_music_generation_updated_at();
