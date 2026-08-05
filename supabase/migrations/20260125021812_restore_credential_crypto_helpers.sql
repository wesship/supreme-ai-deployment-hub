-- Restore credential crypto helpers referenced by later hardening
-- migrations. The helpers remain invoker-security and the later migration
-- removes browser-role execution.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.encrypt_credentials(
  credentials_json jsonb,
  encryption_key text
)
RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT encode(
    pgp_sym_encrypt(credentials_json::text, encryption_key),
    'base64'
  );
$$;

CREATE OR REPLACE FUNCTION public.decrypt_credentials(
  encrypted_data text,
  encryption_key text
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT pgp_sym_decrypt(
    decode(encrypted_data, 'base64'),
    encryption_key
  )::jsonb;
$$;
