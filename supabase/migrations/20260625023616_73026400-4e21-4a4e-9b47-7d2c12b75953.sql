
-- Fix agent_reviews write policies: restrict to authenticated users only
DROP POLICY IF EXISTS "Users can create reviews" ON public.agent_reviews;
CREATE POLICY "Users can create reviews"
  ON public.agent_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reviews" ON public.agent_reviews;
CREATE POLICY "Users can update own reviews"
  ON public.agent_reviews
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reviews" ON public.agent_reviews;
CREATE POLICY "Users can delete own reviews"
  ON public.agent_reviews
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix user_subscriptions policies when the optional billing module exists.
DO $user_subscriptions$
BEGIN
  IF to_regclass('public.user_subscriptions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.user_subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "Users can create own subscriptions" ON public.user_subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.user_subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "Users can cancel own subscriptions" ON public.user_subscriptions';

    EXECUTE $select_policy$
      CREATE POLICY "Users can view own subscriptions"
        ON public.user_subscriptions
        FOR SELECT TO authenticated
        USING (auth.uid() = user_id)
    $select_policy$;

    EXECUTE $insert_policy$
      CREATE POLICY "Users can create own subscriptions"
        ON public.user_subscriptions
        FOR INSERT TO authenticated
        WITH CHECK (auth.uid() = user_id)
    $insert_policy$;

    EXECUTE $update_policy$
      CREATE POLICY "Users can update own subscriptions"
        ON public.user_subscriptions
        FOR UPDATE TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    $update_policy$;

    EXECUTE $delete_policy$
      CREATE POLICY "Users can cancel own subscriptions"
        ON public.user_subscriptions
        FOR DELETE TO authenticated
        USING (auth.uid() = user_id)
    $delete_policy$;

    EXECUTE 'GRANT ALL ON public.user_subscriptions TO service_role';
  END IF;
END
$user_subscriptions$;

-- Ensure service role retains full access
GRANT ALL ON public.agent_reviews TO service_role;
