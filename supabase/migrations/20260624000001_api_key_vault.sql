-- =============================================================================
-- Migration: api_key_vault
-- Purpose:   Persistent, per-user encrypted API key storage for the proxy vault.
--            Keys are stored encrypted (application-layer Fernet encryption via
--            API_KEY_VAULT_SECRET). This table never stores plaintext values.
-- =============================================================================

-- ── Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_key_vault (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        text        NOT NULL CHECK (name ~ '^[A-Z0-9_]+$' AND length(name) <= 128),
    value_enc   text        NOT NULL,          -- Fernet-encrypted ciphertext
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, name)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS api_key_vault_user_idx ON public.api_key_vault (user_id);

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS api_key_vault_updated_at ON public.api_key_vault;
CREATE TRIGGER api_key_vault_updated_at
    BEFORE UPDATE ON public.api_key_vault
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.api_key_vault ENABLE ROW LEVEL SECURITY;

-- Users can only read their own keys (name only; value_enc is never sent to clients)
DROP POLICY IF EXISTS "Users can read own vault keys" ON public.api_key_vault;
CREATE POLICY "Users can read own vault keys"
    ON public.api_key_vault FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Users can insert their own keys
DROP POLICY IF EXISTS "Users can insert own vault keys" ON public.api_key_vault;
CREATE POLICY "Users can insert own vault keys"
    ON public.api_key_vault FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own keys (rotate)
DROP POLICY IF EXISTS "Users can update own vault keys" ON public.api_key_vault;
CREATE POLICY "Users can update own vault keys"
    ON public.api_key_vault FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own keys
DROP POLICY IF EXISTS "Users can delete own vault keys" ON public.api_key_vault;
CREATE POLICY "Users can delete own vault keys"
    ON public.api_key_vault FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Service role (backend) can read all rows for decryption
DROP POLICY IF EXISTS "Service role full access" ON public.api_key_vault;
CREATE POLICY "Service role full access"
    ON public.api_key_vault
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ── Realtime ──────────────────────────────────────────────────────────────────
ALTER TABLE public.api_key_vault REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.api_key_vault;
