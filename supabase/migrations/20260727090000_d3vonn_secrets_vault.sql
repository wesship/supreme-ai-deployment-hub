-- D3VONN Secrets Vault
-- Metadata-only secrets governance. This schema never stores credential values.
-- Initial launch is admin-only; delegated reader roles require a separate reviewed migration.

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;
CREATE POLICY "Users can read their own roles"
    ON public.user_roles FOR SELECT
    USING (auth.uid() = user_id);
GRANT SELECT ON public.user_roles TO authenticated;

CREATE TABLE IF NOT EXISTS public.secret_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    environment TEXT NOT NULL DEFAULT 'production',
    sensitivity TEXT NOT NULL DEFAULT 'internal'
        CHECK (sensitivity IN ('public', 'internal', 'critical')),
    status TEXT NOT NULL DEFAULT 'unverified'
        CHECK (status IN ('unverified', 'active', 'rotation_due', 'rotating', 'missing', 'retired', 'revoked')),
    verification_status TEXT NOT NULL DEFAULT 'unverified'
        CHECK (verification_status IN ('unverified', 'partial', 'verified', 'missing')),
    owner TEXT NOT NULL DEFAULT 'D3VONN.IO Platform Owner',
    purpose TEXT NOT NULL DEFAULT '',
    used_by TEXT[] NOT NULL DEFAULT '{}',
    expected_storage_locations TEXT[] NOT NULL DEFAULT '{}',
    verified_storage_locations TEXT[] NOT NULL DEFAULT '{}',
    source_of_truth TEXT,
    rotation_interval_days INTEGER CHECK (rotation_interval_days IS NULL OR rotation_interval_days > 0),
    last_rotated_at TIMESTAMPTZ,
    last_verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    reference_count INTEGER NOT NULL DEFAULT 0 CHECK (reference_count >= 0),
    reference_files TEXT[] NOT NULL DEFAULT '{}',
    last_reference_scan_at TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT secret_inventory_unique_record UNIQUE (name, platform, environment)
);

CREATE INDEX IF NOT EXISTS idx_secret_inventory_status ON public.secret_inventory(status);
CREATE INDEX IF NOT EXISTS idx_secret_inventory_sensitivity ON public.secret_inventory(sensitivity);
CREATE INDEX IF NOT EXISTS idx_secret_inventory_platform ON public.secret_inventory(platform);
CREATE INDEX IF NOT EXISTS idx_secret_inventory_last_rotated ON public.secret_inventory(last_rotated_at);

CREATE TABLE IF NOT EXISTS public.secret_inventory_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    secret_id UUID REFERENCES public.secret_inventory(id) ON DELETE SET NULL,
    secret_name TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'retired', 'deleted', 'rotation_recorded', 'verification_recorded', 'scan_updated')),
    changed_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_secret_inventory_audit_created ON public.secret_inventory_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_secret_inventory_audit_secret ON public.secret_inventory_audit(secret_id);

ALTER TABLE public.secret_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secret_inventory_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Secrets vault readers can view inventory" ON public.secret_inventory;
DROP POLICY IF EXISTS "Secrets vault admins can view inventory" ON public.secret_inventory;
CREATE POLICY "Secrets vault admins can view inventory"
    ON public.secret_inventory FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Secrets vault admins can insert inventory" ON public.secret_inventory;
CREATE POLICY "Secrets vault admins can insert inventory"
    ON public.secret_inventory FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Secrets vault admins can update inventory" ON public.secret_inventory;
CREATE POLICY "Secrets vault admins can update inventory"
    ON public.secret_inventory FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Secrets vault admins can delete inventory" ON public.secret_inventory;
CREATE POLICY "Secrets vault admins can delete inventory"
    ON public.secret_inventory FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Secrets vault readers can view audit" ON public.secret_inventory_audit;
DROP POLICY IF EXISTS "Secrets vault admins can view audit" ON public.secret_inventory_audit;
CREATE POLICY "Secrets vault admins can view audit"
    ON public.secret_inventory_audit FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.secret_inventory TO authenticated;
GRANT SELECT ON public.secret_inventory_audit TO authenticated;

CREATE OR REPLACE FUNCTION public.set_secret_inventory_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at := now();
    NEW.updated_by := auth.uid();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_secret_inventory_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    audit_action TEXT;
    audit_payload JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        audit_action := 'created';
        audit_payload := jsonb_build_object('record', to_jsonb(NEW));
        INSERT INTO public.secret_inventory_audit(secret_id, secret_name, action, changed_fields, actor_id)
        VALUES (NEW.id, NEW.name, audit_action, audit_payload, auth.uid());
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.last_rotated_at IS DISTINCT FROM NEW.last_rotated_at THEN
            audit_action := 'rotation_recorded';
        ELSIF OLD.last_verified_at IS DISTINCT FROM NEW.last_verified_at THEN
            audit_action := 'verification_recorded';
        ELSIF OLD.reference_count IS DISTINCT FROM NEW.reference_count OR OLD.reference_files IS DISTINCT FROM NEW.reference_files THEN
            audit_action := 'scan_updated';
        ELSIF OLD.status <> 'retired' AND NEW.status = 'retired' THEN
            audit_action := 'retired';
        ELSE
            audit_action := 'updated';
        END IF;
        audit_payload := jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW));
        INSERT INTO public.secret_inventory_audit(secret_id, secret_name, action, changed_fields, actor_id)
        VALUES (NEW.id, NEW.name, audit_action, audit_payload, auth.uid());
        RETURN NEW;
    ELSE
        INSERT INTO public.secret_inventory_audit(secret_id, secret_name, action, changed_fields, actor_id)
        VALUES (OLD.id, OLD.name, 'deleted', jsonb_build_object('record', to_jsonb(OLD)), auth.uid());
        RETURN OLD;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_secret_inventory_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_secret_inventory_updated_at ON public.secret_inventory;
CREATE TRIGGER trg_secret_inventory_updated_at
    BEFORE UPDATE ON public.secret_inventory
    FOR EACH ROW EXECUTE FUNCTION public.set_secret_inventory_updated_at();

DROP TRIGGER IF EXISTS trg_secret_inventory_audit ON public.secret_inventory;
CREATE TRIGGER trg_secret_inventory_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.secret_inventory
    FOR EACH ROW EXECUTE FUNCTION public.audit_secret_inventory_change();

CREATE OR REPLACE VIEW public.secret_inventory_health
WITH (security_invoker = true)
AS
SELECT
    si.*,
    CASE
        WHEN si.status IN ('retired', 'revoked') THEN si.status
        WHEN si.expires_at IS NOT NULL AND si.expires_at <= now() THEN 'expired'
        WHEN si.last_rotated_at IS NULL THEN 'unknown'
        WHEN si.rotation_interval_days IS NOT NULL
             AND si.last_rotated_at + make_interval(days => si.rotation_interval_days) <= now() THEN 'due'
        WHEN si.rotation_interval_days IS NOT NULL
             AND si.last_rotated_at + make_interval(days => si.rotation_interval_days) <= now() + interval '30 days' THEN 'due_soon'
        ELSE 'healthy'
    END AS rotation_health,
    CASE
        WHEN si.last_rotated_at IS NULL OR si.rotation_interval_days IS NULL THEN NULL
        ELSE si.last_rotated_at + make_interval(days => si.rotation_interval_days)
    END AS next_rotation_at
FROM public.secret_inventory si;

GRANT SELECT ON public.secret_inventory_health TO authenticated;

INSERT INTO public.secret_inventory
(name, platform, environment, sensitivity, owner, purpose, used_by, expected_storage_locations, source_of_truth, rotation_interval_days, notes)
VALUES
('OPENAI_API_KEY', 'OpenAI', 'production', 'critical', 'D3VONN.IO Platform Owner', 'Server-side OpenAI API access', ARRAY['Backend','AI agents'], ARRAY['GitHub production environment','Railway backend','Hostinger VPS'], 'OpenAI API Keys', 90, 'Never expose through VITE_* variables.'),
('SUPABASE_ACCESS_TOKEN', 'Supabase', 'ci', 'critical', 'D3VONN.IO Platform Owner', 'Supabase CLI and deployment automation', ARRAY['GitHub Actions'], ARRAY['GitHub production environment'], 'Supabase account access tokens', 90, NULL),
('SUPABASE_DB_PASSWORD', 'Supabase', 'production', 'critical', 'D3VONN.IO Platform Owner', 'Direct PostgreSQL and migration access', ARRAY['GitHub Actions','Backend maintenance'], ARRAY['GitHub production environment','Hostinger VPS'], 'Supabase database settings', 180, NULL),
('SUPABASE_PROJECT_REF', 'Supabase', 'production', 'internal', 'D3VONN.IO Platform Owner', 'Production project identifier', ARRAY['GitHub Actions'], ARRAY['GitHub production environment'], 'Supabase project settings', NULL, 'Identifier, not a credential; still govern changes.'),
('SUPABASE_SERVICE_ROLE_KEY', 'Supabase', 'production', 'critical', 'D3VONN.IO Platform Owner', 'Privileged server-side Supabase operations', ARRAY['Backend','VPS services'], ARRAY['Railway backend','Hostinger VPS'], 'Supabase API settings', 180, 'Rotate on suspected exposure or major maintenance windows.'),
('VITE_SUPABASE_PUBLISHABLE_KEY', 'Supabase', 'all', 'public', 'D3VONN.IO Platform Owner', 'Browser-safe Supabase client authentication', ARRAY['Frontend'], ARRAY['Vercel production','Vercel preview','Local development'], 'Supabase API settings', 365, 'Prefer modern publishable keys over legacy anon JWTs.'),
('VITE_SUPABASE_URL', 'Supabase', 'all', 'public', 'D3VONN.IO Platform Owner', 'Supabase project API URL', ARRAY['Frontend'], ARRAY['Vercel production','Vercel preview','Local development'], 'Supabase project settings', NULL, 'Public configuration value.'),
('DATABASE_URL', 'Supabase', 'production', 'critical', 'D3VONN.IO Platform Owner', 'Backend PostgreSQL connection string', ARRAY['Backend','Workers'], ARRAY['Railway backend','Hostinger VPS'], 'Supabase database settings', 180, NULL),
('RAILWAY_TOKEN', 'Railway', 'ci', 'critical', 'D3VONN.IO Platform Owner', 'Railway deployment automation', ARRAY['GitHub Actions'], ARRAY['GitHub production environment'], 'Railway account tokens', 90, NULL),
('VERCEL_TOKEN', 'Vercel', 'ci', 'critical', 'D3VONN.IO Platform Owner', 'Vercel deployment automation', ARRAY['GitHub Actions'], ARRAY['GitHub production environment'], 'Vercel account tokens', 90, NULL),
('VERCEL_ORG_ID', 'Vercel', 'ci', 'internal', 'D3VONN.IO Platform Owner', 'Vercel team identifier', ARRAY['GitHub Actions'], ARRAY['GitHub production environment'], 'Vercel project settings', NULL, 'Identifier, not a credential.'),
('VERCEL_PROJECT_ID', 'Vercel', 'ci', 'internal', 'D3VONN.IO Platform Owner', 'Vercel project identifier', ARRAY['GitHub Actions'], ARRAY['GitHub production environment'], 'Vercel project settings', NULL, 'Identifier, not a credential.'),
('RESEND_API_KEY', 'Resend', 'production', 'critical', 'D3VONN.IO Platform Owner', 'Transactional email delivery', ARRAY['Backend','Email service'], ARRAY['Railway backend','Hostinger VPS'], 'Resend API Keys', 90, NULL),
('STRIPE_SECRET_KEY', 'Stripe', 'production', 'critical', 'D3VONN.IO Platform Owner', 'Server-side billing operations', ARRAY['Backend','Billing'], ARRAY['Railway backend','Hostinger VPS'], 'Stripe API Keys', 90, NULL),
('STRIPE_WEBHOOK_SECRET', 'Stripe', 'production', 'critical', 'D3VONN.IO Platform Owner', 'Stripe webhook signature verification', ARRAY['Backend','Billing'], ARRAY['Railway backend','Hostinger VPS'], 'Stripe Webhooks', 90, NULL),
('SENTRY_AUTH_TOKEN', 'Sentry', 'ci', 'critical', 'D3VONN.IO Platform Owner', 'Release and source-map upload', ARRAY['GitHub Actions','Deployments'], ARRAY['GitHub production environment'], 'Sentry auth tokens', 90, NULL),
('SENTRY_DSN', 'Sentry', 'all', 'internal', 'D3VONN.IO Platform Owner', 'Runtime error telemetry destination', ARRAY['Frontend','Backend'], ARRAY['Vercel environments','Railway backend'], 'Sentry project settings', 365, 'DSNs are identifiers but should still be scoped by environment.'),
('GITHUB_PAT', 'GitHub', 'ci', 'critical', 'D3VONN.IO Platform Owner', 'Cross-repository or elevated automation', ARRAY['GitHub Actions','Automation'], ARRAY['GitHub environment secrets'], 'GitHub personal access tokens', 90, 'Prefer GITHUB_TOKEN or OIDC whenever possible.'),
('JWT_SECRET', 'D3VONN.IO', 'production', 'critical', 'D3VONN.IO Platform Owner', 'Backend token signing and verification', ARRAY['Backend'], ARRAY['Railway backend','Hostinger VPS'], 'Generated and stored in runtime secret store', 180, NULL),
('ENCRYPTION_KEY', 'D3VONN.IO', 'production', 'critical', 'D3VONN.IO Platform Owner', 'Encryption for approved local encrypted secret storage', ARRAY['Backend','VPS services'], ARRAY['GitHub production environment','Hostinger VPS'], 'Offline recovery vault', 180, NULL),
('REDIS_URL', 'Railway', 'production', 'critical', 'D3VONN.IO Platform Owner', 'Queue, cache, and orchestration connection', ARRAY['Backend','Hermes workers'], ARRAY['Railway backend','Hostinger VPS'], 'Railway service variables', 180, NULL),
('HOSTINGER_VPS_SSH_KEY', 'Hostinger', 'production', 'critical', 'D3VONN.IO Platform Owner', 'Administrative SSH access to production VPS', ARRAY['GitHub Actions','Administrator'], ARRAY['GitHub production environment','Offline encrypted recovery vault'], 'Administrator SSH key store', 365, 'Use a dedicated deploy key with least privilege.'),
('HOSTINGER_VPS_HOST', 'Hostinger', 'production', 'internal', 'D3VONN.IO Platform Owner', 'Production VPS hostname or address', ARRAY['GitHub Actions','Administrator'], ARRAY['GitHub production environment'], 'Hostinger VPS settings', NULL, 'Configuration identifier.'),
('HOSTINGER_VPS_USER', 'Hostinger', 'production', 'internal', 'D3VONN.IO Platform Owner', 'Production deployment account name', ARRAY['GitHub Actions','Administrator'], ARRAY['GitHub production environment'], 'Hostinger VPS settings', NULL, 'Use a non-root deployment account where possible.')
ON CONFLICT (name, platform, environment) DO NOTHING;
