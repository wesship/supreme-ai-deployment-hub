-- Explicit backend-only Data API privileges for Client AI tables.
-- Supabase projects may disable automatic grants for new public tables, so
-- service_role access is declared explicitly while browser roles stay revoked.

grant select, insert, update, delete on table public.client_ai_leads to service_role;
grant select, insert, update, delete on table public.client_ai_profiles to service_role;
grant select, insert, update, delete on table public.client_ai_sources to service_role;
grant select, insert, update, delete on table public.client_ai_memory_commits to service_role;
