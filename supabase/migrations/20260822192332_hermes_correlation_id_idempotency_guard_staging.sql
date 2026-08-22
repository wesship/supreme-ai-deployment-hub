-- Keep staging aligned with production's Hermes idempotency invariant.
create unique index if not exists ux_hermes_tasks_correlation_id_nonnull
  on public.hermes_tasks (correlation_id)
  where correlation_id is not null;
