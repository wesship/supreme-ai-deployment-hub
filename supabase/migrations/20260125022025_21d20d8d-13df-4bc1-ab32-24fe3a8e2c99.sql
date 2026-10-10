-- =====================================================
-- SECURITY FIX: Remove direct credential access from tables
-- Use security definer functions for ALL credential operations
-- =====================================================

-- 1. For api_connections: Create a view without the credentials column
CREATE OR REPLACE VIEW public.api_connections_safe AS
SELECT 
  id,
  user_id,
  service_name,
  auth_type,
  is_valid,
  last_validated_at,
  created_at,
  updated_at
FROM public.api_connections
WHERE user_id = auth.uid();

-- 2. For cloud_credentials: Create safe access view
CREATE OR REPLACE VIEW public.cloud_credentials_safe AS
SELECT 
  id,
  user_id,
  provider,
  region,
  is_active,
  last_validated_at,
  created_at,
  updated_at
FROM public.cloud_credentials
WHERE user_id = auth.uid();

-- 3. For mcp_connections: Create safe access view
CREATE OR REPLACE VIEW public.mcp_connections_safe AS
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
FROM public.mcp_connections
WHERE user_id = auth.uid();

-- 4. Create secure RPC for cloud credentials (like we have for api_connections)
CREATE OR REPLACE FUNCTION public.get_cloud_credential_safe(credential_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', id,
    'provider', provider,
    'region', region,
    'is_active', is_active,
    'last_validated_at', last_validated_at,
    'created_at', created_at
  ) INTO result
  FROM cloud_credentials
  WHERE id = credential_id
    AND user_id = auth.uid();
    
  IF result IS NULL THEN
    RAISE EXCEPTION 'Credential not found or access denied';
  END IF;
  
  RETURN result;
END;
$$;

-- 5. Create secure RPC to list cloud credentials without secrets
CREATE OR REPLACE FUNCTION public.list_cloud_credentials()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', id,
        'provider', provider,
        'region', region,
        'is_active', is_active,
        'last_validated_at', last_validated_at,
        'created_at', created_at
      ) ORDER BY created_at DESC
    ), '[]'::jsonb)
    FROM cloud_credentials
    WHERE user_id = auth.uid()
  );
END;
$$;

-- 6. Create secure RPC for MCP connections without token
CREATE OR REPLACE FUNCTION public.list_mcp_connections_safe()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', id,
        'server_id', server_id,
        'server_name', server_name,
        'server_type', server_type,
        'gateway_url', gateway_url,
        'category', category,
        'custom_config', custom_config,
        'is_active', is_active,
        'last_connected_at', last_connected_at,
        'created_at', created_at
      ) ORDER BY created_at DESC
    ), '[]'::jsonb)
    FROM mcp_connections
    WHERE user_id = auth.uid()
  );
END;
$$;

-- 7. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_cloud_credential_safe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_cloud_credentials() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_mcp_connections_safe() TO authenticated;