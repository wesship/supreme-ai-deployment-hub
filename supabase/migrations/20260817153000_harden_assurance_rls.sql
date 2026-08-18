-- Make the append-only trigger function non-callable from exposed roles.
create or replace function public.assurance_prevent_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'assurance_mcp_audit_log is append-only';
end;
$$;

revoke execute on function public.assurance_prevent_audit_mutation() from public, anon, authenticated;

-- Explicit service-role-only policies preserve the server-side API boundary and
-- eliminate ambiguous no-policy RLS advisories without granting browser access.
create policy "assurance_mcp_gateways_service_role_only" on public.assurance_mcp_gateways for all to service_role using (true) with check (true);
create policy "assurance_mcp_audit_log_service_role_only" on public.assurance_mcp_audit_log for all to service_role using (true) with check (true);
create policy "assurance_csp_reports_service_role_only" on public.assurance_csp_reports for all to service_role using (true) with check (true);
create policy "assurance_route_audits_service_role_only" on public.assurance_route_audits for all to service_role using (true) with check (true);
create policy "assurance_performance_samples_service_role_only" on public.assurance_performance_samples for all to service_role using (true) with check (true);
create policy "assurance_accessibility_audits_service_role_only" on public.assurance_accessibility_audits for all to service_role using (true) with check (true);
create policy "assurance_status_components_service_role_only" on public.assurance_status_components for all to service_role using (true) with check (true);
create policy "assurance_incidents_service_role_only" on public.assurance_incidents for all to service_role using (true) with check (true);
create policy "assurance_maintenance_windows_service_role_only" on public.assurance_maintenance_windows for all to service_role using (true) with check (true);
create policy "assurance_status_subscriptions_service_role_only" on public.assurance_status_subscriptions for all to service_role using (true) with check (true);
create policy "assurance_remediation_items_service_role_only" on public.assurance_remediation_items for all to service_role using (true) with check (true);
