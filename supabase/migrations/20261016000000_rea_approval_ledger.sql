-- REA approval ledger prototype. Migration is additive; no execution capability.
-- No client-side direct grants: access must be via authenticated server-side service.
CREATE TABLE IF NOT EXISTS public.rea_analysis_approvals (
    approval_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    requester_id uuid NOT NULL,
    artifact_sha256 text NOT NULL CHECK (artifact_sha256 ~ '^[a-f0-9]{64}$'),
    purpose text NOT NULL CHECK (length(trim(purpose)) BETWEEN 1 AND 500),
    approved boolean NOT NULL DEFAULT false,
    revoked_at timestamptz,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT rea_approval_expiry_after_creation CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS rea_approvals_tenant_requester_idx
    ON public.rea_analysis_approvals (tenant_id, requester_id, expires_at);
ALTER TABLE public.rea_analysis_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rea_analysis_approvals FROM anon, authenticated;
-- No client policies: access requires explicitly privileged server-side credentials.

CREATE TABLE IF NOT EXISTS public.rea_admission_audit (
    event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id uuid NOT NULL,
    requester_id uuid NOT NULL,
    approval_id uuid,
    artifact_sha256 text NOT NULL CHECK (artifact_sha256 ~ '^[a-f0-9]{64}$'),
    outcome text NOT NULL CHECK (outcome IN ('admitted', 'denied')),
    reason_code text NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rea_audit_tenant_time_idx
    ON public.rea_admission_audit (tenant_id, recorded_at DESC);
ALTER TABLE public.rea_admission_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rea_admission_audit FROM anon, authenticated;
-- Audit immutability must also be enforced for privileged writers before production use.
