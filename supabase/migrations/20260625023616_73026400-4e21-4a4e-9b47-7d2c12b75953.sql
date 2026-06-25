
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

-- Fix user_subscriptions policies: authenticated users can manage their own subscriptions
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Users can view own subscriptions"
  ON public.user_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own subscriptions"
  ON public.user_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON public.user_subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can cancel own subscriptions"
  ON public.user_subscriptions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Ensure service role retains full access
GRANT ALL ON public.agent_reviews TO service_role;
GRANT ALL ON public.user_subscriptions TO service_role;
