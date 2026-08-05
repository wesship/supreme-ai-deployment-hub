-- =============================================================================
-- Migration: user_roles — admin RBAC for OCC route protection
-- =============================================================================
-- Adds a user_roles table that the frontend AdminRoute and backend JWT
-- middleware use to verify admin/operator access to the /occ dashboard.
-- =============================================================================

-- 1. Create user_roles table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer', 'user')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- 2. Enable Row Level Security
-- =============================================================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own roles (needed for frontend AdminRoute check)
DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;
CREATE POLICY "Users can read their own roles"
    ON public.user_roles
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role (backend) has full access via service_role key (bypasses RLS)
-- Admin inserts must be done via Supabase dashboard or service_role key

-- 3. Grant anon/authenticated read access to their own row
-- =============================================================================
GRANT SELECT ON public.user_roles TO authenticated;

-- =============================================================================
-- INSTRUCTIONS: Assign yourself admin role
-- After running this migration, find your user UUID in:
--   Supabase Dashboard → Authentication → Users
-- Then run:
--
-- INSERT INTO public.user_roles (user_id, role)
-- VALUES ('<YOUR_SUPABASE_USER_UUID>', 'admin')
-- ON CONFLICT (user_id, role) DO NOTHING;
-- =============================================================================

SELECT 'user_roles migration complete' AS status, NOW() AS applied_at;
