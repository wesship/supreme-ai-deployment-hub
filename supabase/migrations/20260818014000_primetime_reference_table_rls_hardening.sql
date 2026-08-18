-- PRIMETIME reference-table RLS hardening
--
-- These global reference tables are accessed through trusted FastAPI service-role
-- paths. Direct browser/database access is prohibited. The service_role bypasses
-- RLS by design; anon and authenticated roles receive neither privileges nor a
-- permissive policy.

begin;

alter table public.primetime_roles enable row level security;
alter table public.primetime_compliance_rules enable row level security;

revoke all privileges on table public.primetime_roles from public, anon, authenticated;
revoke all privileges on table public.primetime_compliance_rules from public, anon, authenticated;

grant all privileges on table public.primetime_roles to service_role;
grant all privileges on table public.primetime_compliance_rules to service_role;

drop policy if exists "Deny direct browser access" on public.primetime_roles;
create policy "Deny direct browser access"
  on public.primetime_roles
  as permissive
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "Deny direct browser access" on public.primetime_compliance_rules;
create policy "Deny direct browser access"
  on public.primetime_compliance_rules
  as permissive
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on table public.primetime_roles is
  'Global PRIMETIME role reference table; direct browser access is denied and trusted backend service-role access is required.';
comment on table public.primetime_compliance_rules is
  'Global PRIMETIME compliance-rule reference table; direct browser access is denied and trusted backend service-role access is required.';

commit;
