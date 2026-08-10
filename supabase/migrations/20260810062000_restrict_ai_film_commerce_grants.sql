-- Restrict AI Films commerce jobs to the least privileges required by the application.
-- TRUNCATE bypasses row-level security, so neither anon nor authenticated users
-- should retain broad table privileges inherited from default/public grants.

revoke all privileges on table public.ai_film_commerce_jobs from anon;
revoke all privileges on table public.ai_film_commerce_jobs from authenticated;

grant select, insert, update on table public.ai_film_commerce_jobs to authenticated;
grant all privileges on table public.ai_film_commerce_jobs to service_role;
