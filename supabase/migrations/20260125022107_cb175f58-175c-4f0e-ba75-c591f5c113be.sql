-- =====================================================
-- FIX: Replace security definer views with security invoker views
-- =====================================================

-- Drop the problematic views
DROP VIEW IF EXISTS public.api_connections_safe;
DROP VIEW IF EXISTS public.cloud_credentials_safe;
DROP VIEW IF EXISTS public.mcp_connections_safe;

-- 1. Recreate api_connections_safe view with security_invoker
CREATE VIEW public.api_connections_safe
WITH (security_invoker=on) AS
SELECT 
  id,
  user_id,
  service_name,
  auth_type,
  is_valid,
  last_validated_at,
  created_at,
  updated_at
FROM public.api_connections;

-- 2. Recreate cloud_credentials_safe view with security_invoker
CREATE VIEW public.cloud_credentials_safe
WITH (security_invoker=on) AS
SELECT 
  id,
  user_id,
  provider,
  region,
  is_active,
  last_validated_at,
  created_at,
  updated_at
FROM public.cloud_credentials;

-- 3. Recreate mcp_connections_safe view with security_invoker
CREATE VIEW public.mcp_connections_safe
WITH (security_invoker=on) AS
SELECT 
  id,
  user_id,
  server_id,
  server_name,
  server_type,
  gateway_url,
  category,
  custom_config,
  is_active,
  last_connected_at,
  created_at,
  updated_at
FROM public.mcp_connections;