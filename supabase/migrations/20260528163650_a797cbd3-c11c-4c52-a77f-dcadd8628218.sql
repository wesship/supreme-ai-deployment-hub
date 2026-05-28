
-- 1. Drop misleadingly-named plain-text token column from mcp_connections
ALTER TABLE public.mcp_connections DROP COLUMN IF EXISTS api_token_encrypted;

-- 2. agent_reviews: restrict SELECT to authenticated users (hide reviewer UUIDs from anon)
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.agent_reviews;
CREATE POLICY "Authenticated users can view reviews"
ON public.agent_reviews
FOR SELECT
TO authenticated
USING (true);

-- 3. user_features: allow owners to delete their own rows
CREATE POLICY "Users can delete own features"
ON public.user_features
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
