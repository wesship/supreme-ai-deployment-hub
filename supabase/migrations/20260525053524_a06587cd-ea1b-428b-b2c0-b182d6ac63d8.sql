-- Harden policies and function privileges only for modules present in this schema.
-- Several optional/retired feature tables are absent from current production and
-- staging, so every operation is guarded to keep clean migration replays reliable.

-- 1. agent_earnings: remove user self-insert; remove from realtime publication.
DO $$
BEGIN
  IF to_regclass('public.agent_earnings') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can create their own earnings" ON public.agent_earnings';

    IF EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'agent_earnings'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.agent_earnings';
    END IF;
  END IF;
END
$$;

-- 2. course_lessons: restrict to enrolled authenticated users (admins keep ALL).
DO $$
BEGIN
  IF to_regclass('public.course_lessons') IS NOT NULL
     AND to_regclass('public.enrollments') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can view course lessons" ON public.course_lessons';

    EXECUTE $policy$
      CREATE POLICY "Enrolled users can view course lessons"
      ON public.course_lessons
      FOR SELECT
      TO authenticated
      USING (
        public.is_admin((SELECT auth.uid()))
        OR EXISTS (
          SELECT 1
          FROM public.enrollments e
          WHERE e.course_id = course_lessons.course_id
            AND e.user_id = (SELECT auth.uid())
        )
      )
    $policy$;
  END IF;
END
$$;

-- 3. persona_prompts: require authentication.
DO $$
BEGIN
  IF to_regclass('public.persona_prompts') IS NOT NULL
     AND to_regclass('public.personas') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can read prompts for public personas or admins can read a" ON public.persona_prompts';

    EXECUTE $policy$
      CREATE POLICY "Authenticated users can read prompts for public personas"
      ON public.persona_prompts
      FOR SELECT
      TO authenticated
      USING (
        public.is_admin((SELECT auth.uid()))
        OR EXISTS (
          SELECT 1
          FROM public.personas
          WHERE personas.persona_id = persona_prompts.persona_id
            AND personas.is_public = true
        )
      )
    $policy$;
  END IF;
END
$$;

-- 4. subscription_tiers: restrict reads to authenticated users.
DO $$
BEGIN
  IF to_regclass('public.subscription_tiers') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can view subscription tiers" ON public.subscription_tiers';

    EXECUTE $policy$
      CREATE POLICY "Authenticated users can view subscription tiers"
      ON public.subscription_tiers
      FOR SELECT
      TO authenticated
      USING (true)
    $policy$;
  END IF;
END
$$;

-- 5. Revoke EXECUTE on sensitive helpers when their signatures exist.
DO $$
BEGIN
  IF to_regprocedure('public.encrypt_credentials(jsonb,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.encrypt_credentials(jsonb, text) FROM PUBLIC, anon, authenticated';
  END IF;

  IF to_regprocedure('public.decrypt_credentials(bytea,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.decrypt_credentials(bytea, text) FROM PUBLIC, anon, authenticated';
  END IF;
END
$$;
