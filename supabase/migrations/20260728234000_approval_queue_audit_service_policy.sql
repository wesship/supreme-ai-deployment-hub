-- Resolve Supabase Security Advisor lint 0008 without broadening access.
-- approval_queue_audit remains service-only and protected by RLS.

alter table public.approval_queue_audit enable row level security;

revoke all on table public.approval_queue_audit from public, anon, authenticated;
grant select, insert on table public.approval_queue_audit to service_role;

drop policy if exists approval_queue_audit_service_role_only
  on public.approval_queue_audit;

create policy approval_queue_audit_service_role_only
  on public.approval_queue_audit
  for all
  to service_role
  using (true)
  with check (true);

comment on policy approval_queue_audit_service_role_only
  on public.approval_queue_audit is
  'Explicit service-role-only RLS policy; public, anon, and authenticated grants remain revoked.';
