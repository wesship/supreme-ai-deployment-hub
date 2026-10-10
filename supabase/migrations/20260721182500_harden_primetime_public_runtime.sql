-- Harden PRIMETIME tables and functions after the governed runtime recovery.
--
-- The API accesses these tables through the Supabase service role. Enabling RLS
-- without public policies intentionally denies direct anon/authenticated access
-- while preserving the governed backend path.

alter table public.primetime_roles enable row level security;
alter table public.primetime_ai_agents enable row level security;
alter table public.primetime_ai_actions enable row level security;

-- Pin every PRIMETIME function to trusted schemas so caller-controlled
-- search_path values cannot redirect unqualified object references.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'primetime_%'
  loop
    execute format(
      'alter function %s set search_path = pg_catalog, public',
      fn.signature
    );
  end loop;
end
$$;
