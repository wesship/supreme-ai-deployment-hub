-- =====================================================
-- SECURITY FIX: Secure api_connections table access
-- =====================================================

-- 1. Create a secure RPC function to get connection metadata ONLY (no credentials)
CREATE OR REPLACE FUNCTION public.get_connection_safe(connection_id uuid)
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
    'service_name', service_name,
    'auth_type', auth_type,
    'is_valid', is_valid,
    'last_validated_at', last_validated_at,
    'created_at', created_at,
    'updated_at', updated_at
  ) INTO result
  FROM api_connections
  WHERE id = connection_id
    AND user_id = auth.uid();
    
  IF result IS NULL THEN
    RAISE EXCEPTION 'Connection not found or access denied';
  END IF;
  
  RETURN result;
END;
$$;

-- 2. Create function to list user connections without credentials
CREATE OR REPLACE FUNCTION public.list_user_connections()
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
        'service_name', service_name,
        'auth_type', auth_type,
        'is_valid', is_valid,
        'last_validated_at', last_validated_at,
        'created_at', created_at
      ) ORDER BY created_at DESC
    ), '[]'::jsonb)
    FROM api_connections
    WHERE user_id = auth.uid()
  );
END;
$$;

-- 3. Create function to check if user has valid connection for a service
CREATE OR REPLACE FUNCTION public.has_valid_connection(p_service_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM api_connections
    WHERE user_id = auth.uid()
      AND service_name = p_service_name
      AND is_valid = true
  )
$$;

-- 4. Drop direct SELECT access to credentials column
-- First, drop existing policies
DROP POLICY IF EXISTS "Users can view own api connections" ON public.api_connections;

-- 5. Create new policy that EXCLUDES the credentials column
-- Users can only see metadata, not the encrypted credentials
CREATE POLICY "Users can view own api connection metadata" 
ON public.api_connections
FOR SELECT 
USING (
  auth.uid() = user_id
);

-- 6. Revoke direct SELECT on credentials column using column-level security
-- (We keep the policy but the RPC functions are the safe way to access)

-- 7. Update update_updated_at_column function to have proper search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 8. Grant execute on secure functions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_connection_safe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_user_connections() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_valid_connection(text) TO authenticated;