-- Client AI -> DKOS ingestion tracking.
-- Additive only; keeps the first Client AI migration rollback-safe.

alter table public.client_ai_sources
  add column if not exists ingestion_run_id uuid,
  add column if not exists hermes_task_id uuid,
  add column if not exists current_stage text,
  add column if not exists error_message text,
  add column if not exists completed_at timestamptz;

create index if not exists client_ai_sources_ingestion_run_idx
  on public.client_ai_sources (ingestion_run_id)
  where ingestion_run_id is not null;

create index if not exists client_ai_sources_hermes_task_idx
  on public.client_ai_sources (hermes_task_id)
  where hermes_task_id is not null;

comment on column public.client_ai_sources.ingestion_run_id is
  'Stable Client AI DKOS ingestion run identifier.';
comment on column public.client_ai_sources.hermes_task_id is
  'Hermes task coordinating the DKOS ingestion lifecycle.';
comment on column public.client_ai_sources.current_stage is
  'Last durable DKOS stage reached by the source ingestion run.';
