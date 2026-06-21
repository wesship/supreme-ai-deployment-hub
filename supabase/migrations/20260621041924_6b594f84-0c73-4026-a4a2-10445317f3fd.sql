-- Tighten permissive INSERT policy on error_logs: require authenticated user
DROP POLICY IF EXISTS "anyone insert error_logs" ON public.error_logs;

CREATE POLICY "Authenticated users can insert error logs"
  ON public.error_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);