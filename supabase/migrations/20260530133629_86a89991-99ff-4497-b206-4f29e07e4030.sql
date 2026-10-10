
ALTER TABLE public.hermes_goals REPLICA IDENTITY FULL;
ALTER TABLE public.hermes_tasks REPLICA IDENTITY FULL;
ALTER TABLE public.hermes_interrupts REPLICA IDENTITY FULL;
ALTER TABLE public.hermes_checkpoints REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.hermes_goals; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.hermes_tasks; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.hermes_interrupts; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.hermes_checkpoints; EXCEPTION WHEN duplicate_object THEN NULL; END;
END$$;
