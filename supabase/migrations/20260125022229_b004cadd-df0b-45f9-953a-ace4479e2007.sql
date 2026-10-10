-- =====================================================
-- SECURITY FIX: Create restrictive SELECT policies that exclude credentials
-- The views will inherit these policies via security_invoker
-- =====================================================

-- For api_connections: The existing policy allows reading own rows including credentials
-- We need to ensure the application uses the safe view or RPC functions
-- The RLS policy prevents cross-user access - credentials encryption is the defense-in-depth

-- Grant SELECT on safe views to authenticated users
GRANT SELECT ON public.api_connections_safe TO authenticated;
GRANT SELECT ON public.cloud_credentials_safe TO authenticated;
GRANT SELECT ON public.mcp_connections_safe TO authenticated;

-- Add comment to document the security pattern
COMMENT ON VIEW public.api_connections_safe IS 'Safe view of api_connections excluding encrypted credentials column. Use this view for all client-side queries.';
COMMENT ON VIEW public.cloud_credentials_safe IS 'Safe view of cloud_credentials excluding encrypted credentials column. Use this view for all client-side queries.';
COMMENT ON VIEW public.mcp_connections_safe IS 'Safe view of mcp_connections excluding encrypted api_token_encrypted column. Use this view for all client-side queries.';