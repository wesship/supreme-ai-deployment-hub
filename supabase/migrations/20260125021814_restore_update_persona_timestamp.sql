-- Restore the persona updated_at trigger helper before migrations that
-- restrict its privileges. This keeps fresh preview databases reproducible
-- without relying on functions that existed only in an older remote schema.

CREATE OR REPLACE FUNCTION public.update_persona_timestamp()
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
