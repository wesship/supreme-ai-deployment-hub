alter table public.ai_film_commerce_jobs
  drop constraint if exists ai_film_commerce_jobs_handoff_status_check;

alter table public.ai_film_commerce_jobs
  add constraint ai_film_commerce_jobs_handoff_status_check
  check (
    handoff_status in (
      'pending',
      'queued',
      'processing',
      'completed',
      'not_applicable',
      'failed'
    )
  );
