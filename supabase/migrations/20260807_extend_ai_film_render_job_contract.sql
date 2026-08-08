alter table public.ai_film_render_jobs
  drop constraint if exists ai_film_render_jobs_job_type_check;

alter table public.ai_film_render_jobs
  add constraint ai_film_render_jobs_job_type_check
  check (job_type = any (array[
    'storyboard'::text,
    'keyframe'::text,
    'video'::text,
    'voice'::text,
    'music'::text,
    'trailer'::text,
    'export'::text,
    'avatar'::text,
    'character_replacement'::text,
    'lip_sync'::text,
    'assembly'::text
  ]));

alter table public.ai_film_render_jobs
  drop constraint if exists ai_film_render_jobs_status_check;

alter table public.ai_film_render_jobs
  add constraint ai_film_render_jobs_status_check
  check (status = any (array[
    'queued'::text,
    'running'::text,
    'processing'::text,
    'succeeded'::text,
    'completed'::text,
    'blocked'::text,
    'failed'::text,
    'cancelled'::text
  ]));
