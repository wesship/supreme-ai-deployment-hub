-- Restore the generic updated_at trigger helper before migrations that
-- restrict its privileges. Fresh preview databases must be able to replay
-- the complete migration chain without relying on objects created manually
-- in an older remote environment.

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
