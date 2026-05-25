-- 1. agent_earnings: remove user self-insert; remove from realtime publication
DROP POLICY IF EXISTS "Users can create their own earnings" ON public.agent_earnings;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'agent_earnings'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.agent_earnings';
  END IF;
END$$;

-- 2. course_lessons: restrict to enrolled authenticated users (admins keep ALL)
DROP POLICY IF EXISTS "Anyone can view course lessons" ON public.course_lessons;

CREATE POLICY "Enrolled users can view course lessons"
ON public.course_lessons
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.course_id = course_lessons.course_id
      AND e.user_id = auth.uid()
  )
);

-- 3. persona_prompts: require authenticated
DROP POLICY IF EXISTS "Users can read prompts for public personas or admins can read a" ON public.persona_prompts;

CREATE POLICY "Authenticated users can read prompts for public personas"
ON public.persona_prompts
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.personas
    WHERE personas.persona_id = persona_prompts.persona_id
      AND personas.is_public = true
  )
);

-- 4. subscription_tiers: restrict to authenticated
DROP POLICY IF EXISTS "Anyone can view subscription tiers" ON public.subscription_tiers;

CREATE POLICY "Authenticated users can view subscription tiers"
ON public.subscription_tiers
FOR SELECT
TO authenticated
USING (true);

-- 5. Revoke EXECUTE on sensitive SECURITY DEFINER functions from public/authenticated
REVOKE ALL ON FUNCTION public.encrypt_credentials(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrypt_credentials(bytea, text) FROM PUBLIC, anon, authenticated;