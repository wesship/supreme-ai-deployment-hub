-- Restore historical API-connection prerequisites required by later
-- security migrations. These objects were part of the original schema history
-- but were missing from the repository, which made fresh Supabase preview
-- branches fail before feature migrations could run.

CREATE TYPE public.auth_type AS ENUM (
  'api_key',
  'oauth2',
  'basic_auth',
  'bearer_token'
);

CREATE TABLE public.api_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  auth_type public.auth_type NOT NULL,
  credentials JSONB NOT NULL,
  is_valid BOOLEAN NOT NULL DEFAULT false,
  last_validated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, service_name)
);

ALTER TABLE public.api_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api connections"
ON public.api_connections
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create own api connections"
ON public.api_connections
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own api connections"
ON public.api_connections
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own api connections"
ON public.api_connections
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.update_workflow_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_api_connections_updated_at
BEFORE UPDATE ON public.api_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_workflow_timestamp();

CREATE INDEX idx_api_connections_user_id
  ON public.api_connections(user_id);
CREATE INDEX idx_api_connections_service_name
  ON public.api_connections(service_name);
CREATE INDEX idx_api_connections_is_valid
  ON public.api_connections(is_valid);
