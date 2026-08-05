-- Restore the conversation updated_at trigger helper before migrations
-- that restrict its privileges. This object was present in the historical
-- remote schema but absent from the repository migration chain.

CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
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
