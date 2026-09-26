-- Gate 5: persist result assets and explicit regeneration depth on the active render ledger.

alter table public.ai_film_render_jobs
  add column if not exists result_asset_id uuid,
  add column if not exists result_storage_path text,
  add column if not exists regeneration_count integer not null default 0;

alter table public.ai_film_render_jobs
  drop constraint if exists ai_film_render_jobs_regeneration_count_check;

alter table public.ai_film_render_jobs
  add constraint ai_film_render_jobs_regeneration_count_check
  check (regeneration_count >= 0);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_film_render_jobs_result_asset_fkey'
      and conrelid = 'public.ai_film_render_jobs'::regclass
  ) then
    alter table public.ai_film_render_jobs
      add constraint ai_film_render_jobs_result_asset_fkey
      foreign key (result_asset_id)
      references public.ai_film_assets(id)
      on delete set null;
  end if;
end $$;

create index if not exists ai_film_render_jobs_result_asset_idx
  on public.ai_film_render_jobs(result_asset_id)
  where result_asset_id is not null;

create index if not exists ai_film_render_jobs_regeneration_idx
  on public.ai_film_render_jobs(parent_job_id, regeneration_count)
  where parent_job_id is not null;

comment on column public.ai_film_render_jobs.result_asset_id is
  'Generated AI Films asset produced by this render job.';
comment on column public.ai_film_render_jobs.result_storage_path is
  'Private storage object path for the generated result; never a signed URL.';
comment on column public.ai_film_render_jobs.regeneration_count is
  'Zero-based regeneration depth used with parent_job_id to enforce bounded auto-regeneration.';
