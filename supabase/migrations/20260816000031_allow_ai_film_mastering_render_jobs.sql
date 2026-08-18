-- Allow durable AI FILMS mastering jobs in the shared render-job queue.
-- Production was already updated with this zero-downtime constraint repair;
-- this migration keeps source control and future environments aligned.

ALTER TABLE public.ai_film_render_jobs
  DROP CONSTRAINT IF EXISTS ai_film_render_jobs_job_type_check;

ALTER TABLE public.ai_film_render_jobs
  ADD CONSTRAINT ai_film_render_jobs_job_type_check
  CHECK (
    job_type = ANY (
      ARRAY[
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
        'assembly'::text,
        'mastering'::text
      ]
    )
  );
