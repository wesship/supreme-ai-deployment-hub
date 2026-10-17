CREATE OR REPLACE FUNCTION public.get_hermes_public_stats()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'active_agents', (SELECT count(*) FROM deployed_agents WHERE status IN ('active','running','healthy')),
    'active_goals', (SELECT count(*) FROM hermes_goals WHERE status = 'active'),
    'tasks_completed', (SELECT count(*) FROM hermes_tasks WHERE status = 'completed'),
    'tasks_running', (SELECT count(*) FROM hermes_tasks WHERE status IN ('processing','running')),
    'queue_pending', (SELECT count(*) FROM hermes_tasks WHERE status = 'pending'),
    'last_activity_at', (SELECT max(created_at) FROM hermes_events)
  );
$$;
REVOKE ALL ON FUNCTION public.get_hermes_public_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_hermes_public_stats() TO anon, authenticated, service_role;