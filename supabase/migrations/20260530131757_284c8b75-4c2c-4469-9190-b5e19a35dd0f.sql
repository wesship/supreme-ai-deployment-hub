
-- ============================================================================
-- Hermes Intelligence Fabric tables
-- ============================================================================

CREATE TABLE public.hermes_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hermes_goals TO authenticated;
GRANT ALL ON public.hermes_goals TO service_role;
ALTER TABLE public.hermes_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners select hermes_goals" ON public.hermes_goals FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "owners insert hermes_goals" ON public.hermes_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owners update hermes_goals" ON public.hermes_goals FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "owners delete hermes_goals" ON public.hermes_goals FOR DELETE USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE TABLE public.hermes_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal_id uuid NOT NULL REFERENCES public.hermes_goals(id) ON DELETE CASCADE,
  parent_task_id uuid,
  kind text NOT NULL DEFAULT 'task',
  title text,
  status text NOT NULL DEFAULT 'pending',
  depth integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hermes_tasks TO authenticated;
GRANT ALL ON public.hermes_tasks TO service_role;
ALTER TABLE public.hermes_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners select hermes_tasks" ON public.hermes_tasks FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "owners insert hermes_tasks" ON public.hermes_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owners update hermes_tasks" ON public.hermes_tasks FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "owners delete hermes_tasks" ON public.hermes_tasks FOR DELETE USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE TABLE public.hermes_interrupts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.hermes_tasks(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.hermes_goals(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  response text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hermes_interrupts TO authenticated;
GRANT ALL ON public.hermes_interrupts TO service_role;
ALTER TABLE public.hermes_interrupts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners select hermes_interrupts" ON public.hermes_interrupts FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "owners insert hermes_interrupts" ON public.hermes_interrupts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owners update hermes_interrupts" ON public.hermes_interrupts FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "owners delete hermes_interrupts" ON public.hermes_interrupts FOR DELETE USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE TABLE public.hermes_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal_id uuid NOT NULL REFERENCES public.hermes_goals(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hermes_checkpoints TO authenticated;
GRANT ALL ON public.hermes_checkpoints TO service_role;
ALTER TABLE public.hermes_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners select hermes_checkpoints" ON public.hermes_checkpoints FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "owners insert hermes_checkpoints" ON public.hermes_checkpoints FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owners update hermes_checkpoints" ON public.hermes_checkpoints FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "owners delete hermes_checkpoints" ON public.hermes_checkpoints FOR DELETE USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE TABLE public.hermes_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal_id uuid REFERENCES public.hermes_goals(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.hermes_tasks(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hermes_events TO authenticated;
GRANT ALL ON public.hermes_events TO service_role;
ALTER TABLE public.hermes_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners select hermes_events" ON public.hermes_events FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "owners insert hermes_events" ON public.hermes_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- OCC Observability tables (admin-visible)
-- ============================================================================

CREATE TABLE public.ai_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  model text NOT NULL,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  cost_usd numeric,
  duration_ms integer,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  endpoint text,
  request_id text
);
GRANT SELECT, INSERT ON public.ai_request_logs TO authenticated;
GRANT ALL ON public.ai_request_logs TO service_role;
ALTER TABLE public.ai_request_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own ai logs or admin" ON public.ai_request_logs FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "users insert own ai logs" ON public.ai_request_logs FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE TABLE public.tool_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  agent_id uuid NOT NULL,
  session_id uuid,
  tool_name text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  duration_ms integer,
  error_message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT ON public.tool_call_logs TO authenticated;
GRANT ALL ON public.tool_call_logs TO service_role;
ALTER TABLE public.tool_call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own tool logs or admin" ON public.tool_call_logs FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "users insert own tool logs" ON public.tool_call_logs FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE TABLE public.agent_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  agent_id uuid NOT NULL,
  agent_name text,
  event_type text NOT NULL,
  session_id uuid,
  duration_ms integer,
  tokens_used integer,
  cost_usd numeric,
  status text NOT NULL DEFAULT 'success',
  error_message text
);
GRANT SELECT, INSERT ON public.agent_activity_logs TO authenticated;
GRANT ALL ON public.agent_activity_logs TO service_role;
ALTER TABLE public.agent_activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own agent activity or admin" ON public.agent_activity_logs FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "users insert own agent activity" ON public.agent_activity_logs FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE TABLE public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  error_type text NOT NULL,
  severity text NOT NULL DEFAULT 'error',
  message text NOT NULL,
  service text,
  endpoint text,
  stack_trace text,
  resolved boolean NOT NULL DEFAULT false,
  occurrence_count integer NOT NULL DEFAULT 1,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.error_logs TO authenticated;
GRANT ALL ON public.error_logs TO service_role;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read error_logs" ON public.error_logs FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "anyone insert error_logs" ON public.error_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "admins update error_logs" ON public.error_logs FOR UPDATE USING (is_admin(auth.uid()));

CREATE TABLE public.approval_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  action_type text NOT NULL,
  description text NOT NULL,
  requested_by uuid,
  status text NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'normal',
  expires_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT, UPDATE ON public.approval_queue TO authenticated;
GRANT ALL ON public.approval_queue TO service_role;
ALTER TABLE public.approval_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requesters or admins read approval_queue" ON public.approval_queue FOR SELECT USING (auth.uid() = requested_by OR is_admin(auth.uid()));
CREATE POLICY "users request approvals" ON public.approval_queue FOR INSERT WITH CHECK (auth.uid() = requested_by);
CREATE POLICY "admins review approvals" ON public.approval_queue FOR UPDATE USING (is_admin(auth.uid()));

CREATE TABLE public.user_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL UNIQUE,
  plan_name text NOT NULL DEFAULT 'free',
  plan_tier integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  tokens_limit integer NOT NULL DEFAULT 100000,
  tokens_used integer NOT NULL DEFAULT 0,
  requests_limit integer NOT NULL DEFAULT 1000,
  requests_used integer NOT NULL DEFAULT 0,
  reset_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.user_plans TO authenticated;
GRANT ALL ON public.user_plans TO service_role;
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own plan or admin" ON public.user_plans FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "admins manage plans insert" ON public.user_plans FOR INSERT WITH CHECK (is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "admins manage plans update" ON public.user_plans FOR UPDATE USING (is_admin(auth.uid()));

CREATE TABLE public.rag_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  title text NOT NULL,
  description text,
  file_name text,
  file_type text,
  file_size_bytes bigint,
  status text NOT NULL DEFAULT 'pending',
  chunk_count integer,
  namespace text,
  tags text[],
  indexed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rag_documents TO authenticated;
GRANT ALL ON public.rag_documents TO service_role;
ALTER TABLE public.rag_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own rag docs or admin" ON public.rag_documents FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "users insert own rag docs" ON public.rag_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own rag docs" ON public.rag_documents FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "users delete own rag docs" ON public.rag_documents FOR DELETE USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- Helpful indexes
CREATE INDEX idx_hermes_tasks_goal ON public.hermes_tasks(goal_id);
CREATE INDEX idx_hermes_tasks_user_status ON public.hermes_tasks(user_id, status);
CREATE INDEX idx_hermes_events_goal ON public.hermes_events(goal_id);
CREATE INDEX idx_ai_request_logs_user_created ON public.ai_request_logs(user_id, created_at DESC);
CREATE INDEX idx_error_logs_resolved ON public.error_logs(resolved, created_at DESC);
CREATE INDEX idx_approval_queue_status ON public.approval_queue(status, created_at DESC);
