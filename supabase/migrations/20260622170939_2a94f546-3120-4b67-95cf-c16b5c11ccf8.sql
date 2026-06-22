
-- =========================================================
-- 1) agent_reviews: restrict SELECT to owners; public-safe view for others
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can view reviews" ON public.agent_reviews;

CREATE POLICY "Users can view their own reviews"
  ON public.agent_reviews FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE VIEW public.agent_reviews_public
WITH (security_invoker = on) AS
SELECT id, template_id, rating, title, content, created_at
FROM public.agent_reviews;

GRANT SELECT ON public.agent_reviews_public TO anon, authenticated;

-- =========================================================
-- 2) subscription_tiers: hide stripe_price_id_* from clients
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can view subscription tiers" ON public.subscription_tiers;

-- Admin-manage policy remains. No SELECT for regular users on base table.

CREATE OR REPLACE VIEW public.subscription_tiers_public
WITH (security_invoker = on) AS
SELECT id, name, price_monthly, price_yearly, features, created_at
FROM public.subscription_tiers;

GRANT SELECT ON public.subscription_tiers_public TO anon, authenticated;

-- =========================================================
-- 3) realtime.messages: scope channel access by auth.uid() topic prefix
-- =========================================================
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can receive on their own topic" ON realtime.messages;
DROP POLICY IF EXISTS "Users can send on their own topic" ON realtime.messages;

CREATE POLICY "Users can receive on their own topic"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    realtime.topic() IS NOT NULL
    AND (
      realtime.topic() = auth.uid()::text
      OR realtime.topic() LIKE auth.uid()::text || ':%'
    )
  );

CREATE POLICY "Users can send on their own topic"
  ON realtime.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.topic() IS NOT NULL
    AND (
      realtime.topic() = auth.uid()::text
      OR realtime.topic() LIKE auth.uid()::text || ':%'
    )
  );
