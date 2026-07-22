-- D3VONN.IO Supabase RLS hardening — Phase 2A
--
-- Conservative baseline for governed AI, Primetime, and legacy operational
-- tables that are accessed through trusted FastAPI / service-role paths.
-- Direct browser access is explicitly denied. This migration is append-only,
-- idempotent, and must be validated on an isolated Supabase branch before any
-- production promotion.

begin;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'ai_action_ledger',
    'ai_approval_requests',
    'ai_assistance_requests',
    'ai_assistance_outputs',
    'ai_compliance_findings',
    'ai_agents',
    'ai_agent_versions',
    'approval_requests',
    'rag_document_logs',
    'primetime_workspaces',
    'primetime_workspace_memberships',
    'primetime_roles',
    'primetime_people',
    'primetime_households',
    'primetime_household_members',
    'primetime_leads',
    'primetime_tasks',
    'primetime_activities',
    'primetime_ai_actions',
    'primetime_ai_agents',
    'primetime_audit_events',
    'primetime_consent_records',
    'primetime_suppression_records',
    'primetime_release_exceptions'
  ] loop
    if to_regclass(format('public.%I', tbl)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', tbl);

    -- Remove every direct browser-facing table privilege, including any grant
    -- inherited through the PostgreSQL PUBLIC pseudo-role.
    execute format(
      'revoke all privileges on table public.%I from public, anon, authenticated',
      tbl
    );

    -- Trusted backend and Edge Function paths use service_role and must retain
    -- full access. service_role bypasses RLS by design.
    execute format(
      'grant all privileges on table public.%I to service_role',
      tbl
    );

    -- An explicit deny policy documents the intended boundary and clears the
    -- ambiguous "RLS enabled but no policy" posture without opening access.
    execute format(
      'drop policy if exists %I on public.%I',
      'Deny direct browser access',
      tbl
    );
    execute format(
      'create policy %I on public.%I as permissive for all to anon, authenticated using (false) with check (false)',
      'Deny direct browser access',
      tbl
    );
  end loop;
end $$;

commit;
