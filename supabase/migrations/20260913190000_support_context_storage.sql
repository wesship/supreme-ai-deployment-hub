-- Sensitive support-context persistence. No questionnaire text is stored.

CREATE TABLE IF NOT EXISTS public.support_journal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL CHECK (btrim(tenant_id) <> ''),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload_ciphertext text NOT NULL CHECK (btrim(payload_ciphertext) <> ''),
  payload_format text NOT NULL DEFAULT 'sealed-v1',
  safety_state text NOT NULL CHECK (btrim(safety_state) <> ''),
  policy_version text NOT NULL CHECK (btrim(policy_version) <> ''),
  consent_version text NOT NULL CHECK (btrim(consent_version) <> ''),
  consented_at timestamptz NOT NULL,
  retention_policy_version text NOT NULL DEFAULT 'pending-review',
  retention_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_screening_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL CHECK (btrim(tenant_id) <> ''),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instrument_id text NOT NULL CHECK (instrument_id = 'external-reviewed'),
  instrument_version text NOT NULL CHECK (btrim(instrument_version) <> ''),
  scoring_version text NOT NULL CHECK (btrim(scoring_version) <> ''),
  source text NOT NULL CHECK (source = 'approved-screening-adapter'),
  score numeric NOT NULL CHECK (score >= 0),
  max_score numeric NOT NULL CHECK (max_score > 0 AND score <= max_score),
  safety_state text NOT NULL CHECK (btrim(safety_state) <> ''),
  policy_version text NOT NULL CHECK (btrim(policy_version) <> ''),
  consent_version text NOT NULL CHECK (btrim(consent_version) <> ''),
  consented_at timestamptz NOT NULL,
  retention_policy_version text NOT NULL DEFAULT 'pending-review',
  retention_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_journal_records_user_idx ON public.support_journal_records(user_id);
CREATE INDEX IF NOT EXISTS support_journal_records_tenant_user_idx ON public.support_journal_records(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS support_screening_records_user_idx ON public.support_screening_records(user_id);
CREATE INDEX IF NOT EXISTS support_screening_records_tenant_user_idx ON public.support_screening_records(tenant_id, user_id);

ALTER TABLE public.support_journal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_screening_records ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.support_journal_records FROM anon, authenticated;
REVOKE ALL ON TABLE public.support_screening_records FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.support_journal_records TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.support_screening_records TO authenticated;

CREATE POLICY "support journals select own tenant" ON public.support_journal_records FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id AND (select auth.jwt()->'app_metadata'->>'tenant_id') = tenant_id);
CREATE POLICY "support journals insert own tenant" ON public.support_journal_records FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id AND (select auth.jwt()->'app_metadata'->>'tenant_id') = tenant_id);
CREATE POLICY "support journals update own tenant" ON public.support_journal_records FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id AND (select auth.jwt()->'app_metadata'->>'tenant_id') = tenant_id)
WITH CHECK ((select auth.uid()) = user_id AND (select auth.jwt()->'app_metadata'->>'tenant_id') = tenant_id);
CREATE POLICY "support journals delete own tenant" ON public.support_journal_records FOR DELETE TO authenticated
USING ((select auth.uid()) = user_id AND (select auth.jwt()->'app_metadata'->>'tenant_id') = tenant_id);

CREATE POLICY "support screenings select own tenant" ON public.support_screening_records FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id AND (select auth.jwt()->'app_metadata'->>'tenant_id') = tenant_id);
CREATE POLICY "support screenings insert own tenant" ON public.support_screening_records FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id AND (select auth.jwt()->'app_metadata'->>'tenant_id') = tenant_id);
CREATE POLICY "support screenings delete own tenant" ON public.support_screening_records FOR DELETE TO authenticated
USING ((select auth.uid()) = user_id AND (select auth.jwt()->'app_metadata'->>'tenant_id') = tenant_id);
