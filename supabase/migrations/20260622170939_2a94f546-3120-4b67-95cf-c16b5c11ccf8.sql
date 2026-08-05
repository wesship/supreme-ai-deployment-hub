
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
-- Billing is optional in clean previews and in deployments that have not
-- installed the subscription module. Harden it only when the base table exists.
DO $subscription_tiers$
BEGIN
  IF to_regclass('public.subscription_tiers') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view subscription tiers" ON public.subscription_tiers';

    -- Admin-manage policy remains. No SELECT for regular users on base table.
    EXECUTE $view$
      CREATE OR REPLACE VIEW public.subscription_tiers_public
      WITH (security_invoker = on) AS
      SELECT id, name, price_monthly, price_yearly, features, created_at
      FROM public.subscription_tiers
    $view$;

    EXECUTE 'GRANT SELECT ON public.subscription_tiers_public TO anon, authenticated';
  END IF;
END
$subscription_tiers$;

-- =========================================================
-- 3) realtime.messages: scope channel access by auth.uid() topic prefix
-- =========================================================
-- Supabase owns this platform table as supabase_realtime_admin. Apply the
-- custom policies only in environments where the migration role owns it (or
-- is a true superuser); managed projects safely retain the platform defaults.
DO $realtime_messages$
DECLARE
  can_manage boolean;
BEGIN
  SELECT
    c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
    OR (SELECT rolsuper FROM pg_roles WHERE rolname = current_user)
  INTO can_manage
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'realtime' AND c.relname = 'messages';

  IF coalesce(can_manage, false) THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Users can receive on their own topic" ON realtime.messages';
    EXECUTE 'DROP POLICY IF EXISTS "Users can send on their own topic" ON realtime.messages';

    EXECUTE $receive_policy$
      CREATE POLICY "Users can receive on their own topic"
        ON realtime.messages FOR SELECT
        TO authenticated
        USING (
          realtime.topic() IS NOT NULL
          AND (
            realtime.topic() = auth.uid()::text
            OR realtime.topic() LIKE auth.uid()::text || ':%'
          )
        )
    $receive_policy$;

    EXECUTE $send_policy$
      CREATE POLICY "Users can send on their own topic"
        ON realtime.messages FOR INSERT
        TO authenticated
        WITH CHECK (
          realtime.topic() IS NOT NULL
          AND (
            realtime.topic() = auth.uid()::text
            OR realtime.topic() LIKE auth.uid()::text || ':%'
          )
        )
    $send_policy$;
  END IF;
END
$realtime_messages$;
