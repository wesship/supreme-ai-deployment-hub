-- Keep Hermes durable worker control tables backend-only.
-- Production was activated with RLS enabled and no end-user policies; this migration
-- makes the intended privilege boundary durable for fresh environments and db push.

alter table public.hermes_workers enable row level security;
alter table public.hermes_worker_leases enable row level security;

revoke all on table public.hermes_workers from anon, authenticated;
revoke all on table public.hermes_worker_leases from anon, authenticated;

grant select, insert, update, delete on table public.hermes_workers to service_role;
grant select, insert, update, delete on table public.hermes_worker_leases to service_role;
