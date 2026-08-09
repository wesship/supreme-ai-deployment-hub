-- PRIMETIME Phase 29 staging: enable database-change streaming for operational event tables.
-- Applied first to the isolated PRIMETIME_DEVONN_STAGING project.

alter publication supabase_realtime add table
  public.fabric_events,
  public.connector_actions,
  public.security_events,
  public.reliability_incidents,
  public.telemetry_signals;
