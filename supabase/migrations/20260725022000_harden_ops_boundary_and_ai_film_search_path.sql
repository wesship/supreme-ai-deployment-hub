-- Harden operations persistence as a backend/service-role boundary.
-- Supabase default grants can expose table privileges and SECURITY DEFINER
-- execution even when RLS has no browser-facing policies.

begin;

revoke all privileges on table
  public.ops_health_checks,
  public.ops_incidents,
  public.ops_alerts,
  public.ops_remediations,
  public.ops_approvals,
  public.ops_audit_events
from public, anon, authenticated;

revoke execute on function public.ops_open_incident(text, text, text, text, text, jsonb)
from public, anon, authenticated;

grant execute on function public.ops_open_incident(text, text, text, text, text, jsonb)
to service_role;

-- The trigger only uses NEW and pg_catalog.now(); pin the lookup path so caller
-- role settings cannot influence object resolution.
alter function public.ai_film_touch_updated_at()
  set search_path = pg_catalog, public;

commit;
