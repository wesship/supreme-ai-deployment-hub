-- Align credential crypto helpers with the historical database signatures
-- referenced by the privilege-hardening migration.

DROP FUNCTION IF EXISTS public.decrypt_credentials(text, text);
DROP FUNCTION IF EXISTS public.decrypt_credentials(bytea, text);
DROP FUNCTION IF EXISTS public.encrypt_credentials(jsonb, text);

CREATE OR REPLACE FUNCTION public.encrypt_credentials(
  credentials_json jsonb,
  encryption_key text
)
RETURNS bytea
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT pgp_sym_encrypt(credentials_json::text, encryption_key);
$$;

CREATE OR REPLACE FUNCTION public.decrypt_credentials(
  encrypted_data bytea,
  encryption_key text
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT pgp_sym_decrypt(encrypted_data, encryption_key)::jsonb;
$$;
