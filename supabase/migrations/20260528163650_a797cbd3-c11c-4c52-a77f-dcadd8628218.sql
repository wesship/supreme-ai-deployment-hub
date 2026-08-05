-- Apply optional-module hardening only when the related tables exist.

-- 1. The legacy api_token_encrypted column is intentionally retained here.
-- Removing a column is a contract migration and must follow application
-- deprecation plus an explicit rollback window.

-- 2. Hide reviewer UUIDs from anonymous users when agent reviews exist.
DO $$
BEGIN
  IF to_regclass('public.agent_reviews') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can view reviews" ON public.agent_reviews';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view reviews" ON public.agent_reviews';

    EXECUTE $policy$
      CREATE POLICY "Authenticated users can view reviews"
      ON public.agent_reviews
      FOR SELECT
      TO authenticated
      USING (true)
    $policy$;
  END IF;
END
$$;

-- 3. Let owners delete their own feature rows when user_features exists.
DO $$
BEGIN
  IF to_regclass('public.user_features') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete own features" ON public.user_features';

    EXECUTE $policy$
      CREATE POLICY "Users can delete own features"
      ON public.user_features
      FOR DELETE
      TO authenticated
      USING ((SELECT auth.uid()) = user_id)
    $policy$;
  END IF;
END
$$;
