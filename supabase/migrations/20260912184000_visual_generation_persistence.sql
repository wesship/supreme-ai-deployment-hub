-- Persist D3VONN Visual Prompt Intelligence provenance on the active AI Films render ledger.
-- The active generation dispatcher writes ai_film_render_jobs. This migration extends
-- that existing owner-scoped/RLS-protected table rather than creating a competing ledger.

alter table public.ai_film_render_jobs
  add column if not exists visual_context jsonb not null default '{}'::jsonb,
  add column if not exists cost_metadata jsonb not null default '{}'::jsonb,
  add column if not exists quality_metadata jsonb not null default '{}'::jsonb,
  add column if not exists parent_job_id uuid,
  add column if not exists source_subsystem text not null default 'ai_films';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_film_render_jobs_parent_job_fkey'
      and conrelid = 'public.ai_film_render_jobs'::regclass
  ) then
    alter table public.ai_film_render_jobs
      add constraint ai_film_render_jobs_parent_job_fkey
      foreign key (parent_job_id)
      references public.ai_film_render_jobs(id)
      on delete set null;
  end if;
end $$;

create index if not exists ai_film_render_jobs_parent_job_idx
  on public.ai_film_render_jobs(parent_job_id)
  where parent_job_id is not null;

create index if not exists ai_film_render_jobs_visual_style_idx
  on public.ai_film_render_jobs ((visual_context ->> 'style_id'))
  where visual_context ? 'style_id';

create index if not exists ai_film_render_jobs_source_subsystem_idx
  on public.ai_film_render_jobs(source_subsystem, created_at desc);

-- Preserve the existing API exposure intentionally. New Supabase projects no longer
-- receive broad Data API grants implicitly, so keep the reviewed grant set explicit.
revoke all on table public.ai_film_render_jobs from anon;
grant select, insert, update, delete on table public.ai_film_render_jobs to authenticated;
grant all on table public.ai_film_render_jobs to service_role;

comment on column public.ai_film_render_jobs.visual_context is
  'Visual Prompt Intelligence provenance: original/compiled prompts, negative prompt, style id/source, compiler metadata, and shot-level overrides. Never store provider secrets.';
comment on column public.ai_film_render_jobs.cost_metadata is
  'Provider usage/cost metadata safe for operational persistence; no credentials.';
comment on column public.ai_film_render_jobs.quality_metadata is
  'Automated/human quality scores and regeneration decision metadata.';
comment on column public.ai_film_render_jobs.parent_job_id is
  'Optional lineage pointer for regeneration/edit descendants.';
