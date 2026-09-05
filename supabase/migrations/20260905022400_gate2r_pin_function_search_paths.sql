-- Gate 2-R: pin mutable function search paths without changing invoker semantics.

begin;

alter function public.greatest_severity(text, text) set search_path = pg_catalog, public;
alter function public.hermes_set_updated_at() set search_path = pg_catalog, public;
alter function public.primetime_enforce_outbound_policy() set search_path = pg_catalog, public;
alter function public.primetime_prevent_audit_mutation() set search_path = pg_catalog, public;
alter function public.primetime_prevent_release_gate_deletion() set search_path = pg_catalog, public;
alter function public.primetime_prevent_snapshot_mutation() set search_path = pg_catalog, public;
alter function public.primetime_record_stage_transition() set search_path = pg_catalog, public;
alter function public.primetime_release7_prevent_delete() set search_path = pg_catalog, public;
alter function public.primetime_release7_prevent_history_mutation() set search_path = pg_catalog, public;
alter function public.primetime_release7_safe_dimensions(jsonb) set search_path = pg_catalog, public;
alter function public.primetime_release7_touch_updated_at() set search_path = pg_catalog, public;
alter function public.primetime_require_ai_audit_event() set search_path = pg_catalog, public;
alter function public.primetime_scan_release1_exceptions(uuid) set search_path = pg_catalog, public;
alter function public.primetime_seed_pipeline_stages(uuid) set search_path = pg_catalog, public;
alter function public.primetime_touch_updated_at() set search_path = pg_catalog, public;
alter function public.primetime_update_lead_last_activity() set search_path = pg_catalog, public;

commit;
