-- Drop the orphaned api_connections_metadata view that causes confusion
-- This is a duplicate - the security definer function already provides this data
DROP VIEW IF EXISTS public.api_connections_metadata CASCADE;