-- Keep the public readiness probe callable without elevated execution context.
-- The function exposes only fixed schema-presence booleans and reads no user data.

begin;

alter function public.dashboard_schema_readiness()
  security invoker;

notify pgrst, 'reload schema';

commit;
