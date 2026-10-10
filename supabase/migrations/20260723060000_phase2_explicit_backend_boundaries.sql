begin;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'agent_performance_snapshots',
    'ai_action_metric_snapshots',
    'ai_knowledge_citations',
    'analytics_metric_definitions',
    'analytics_snapshots',
    'communication_events',
    'communication_frequency_counters',
    'communication_policy_checks',
    'communication_preferences',
    'communications',
    'compliance_metric_snapshots',
    'dashboard_widgets',
    'executive_dashboards',
    'funnel_stage_snapshots',
    'message_template_versions',
    'message_templates',
    'primetime_pipeline_stages',
    'primetime_stage_transitions',
    'release_governance_observations',
    'user_plan_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security', target_table);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', target_table);
    execute format('grant all privileges on table public.%I to service_role', target_table);
    execute format('drop policy if exists "Explicit backend-only boundary" on public.%I', target_table);
    execute format(
      'create policy "Explicit backend-only boundary" on public.%I for all to anon, authenticated using (false) with check (false)',
      target_table
    );
    execute format(
      'comment on table public.%I is %L',
      target_table,
      'Backend-only until workspace membership and browser authorization contracts are implemented and validated under issue #504.'
    );
  end loop;
end
$$;

commit;
