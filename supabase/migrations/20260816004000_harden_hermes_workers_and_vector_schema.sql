-- Resolve current production Security Advisor findings without broadening client access.
begin;

create schema if not exists extensions;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'vector')
     and exists (select 1 from pg_extension where extname = 'vector' and extrelocatable)
     and (
       select n.nspname
       from pg_extension e
       join pg_namespace n on n.oid = e.extnamespace
       where e.extname = 'vector'
     ) <> 'extensions'
  then
    alter extension vector set schema extensions;
  end if;
end
$$;

grant usage on schema extensions to anon, authenticated, service_role;

-- These Hermes worker-control tables are backend-only. Preserve that boundary
-- with both revoked direct-client grants and explicit deny-all RLS policies.
revoke all privileges on table
  public.hermes_workers,
  public.hermes_worker_leases
from anon, authenticated;

drop policy if exists "hermes_workers direct clients denied" on public.hermes_workers;
create policy "hermes_workers direct clients denied"
on public.hermes_workers
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "hermes_worker_leases direct clients denied" on public.hermes_worker_leases;
create policy "hermes_worker_leases direct clients denied"
on public.hermes_worker_leases
for all
to anon, authenticated
using (false)
with check (false);

notify pgrst, 'reload schema';
commit;
