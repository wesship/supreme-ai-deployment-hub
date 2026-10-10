-- Enforce Hermes task idempotency at the database boundary.
-- correlation_id is nullable for legacy/system tasks, so uniqueness is partial.
create unique index if not exists ux_hermes_tasks_correlation_id_nonnull
  on public.hermes_tasks (correlation_id)
  where correlation_id is not null;
