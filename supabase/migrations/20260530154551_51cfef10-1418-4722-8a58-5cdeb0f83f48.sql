ALTER TABLE public.ai_request_logs REPLICA IDENTITY FULL;
ALTER TABLE public.tool_call_logs REPLICA IDENTITY FULL;
ALTER TABLE public.agent_activity_logs REPLICA IDENTITY FULL;
ALTER TABLE public.error_logs REPLICA IDENTITY FULL;
ALTER TABLE public.approval_queue REPLICA IDENTITY FULL;
ALTER TABLE public.user_plans REPLICA IDENTITY FULL;
ALTER TABLE public.rag_documents REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_request_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tool_call_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.error_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.approval_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rag_documents;