-- Staged and verified first on D3VONN.IO-staging.
-- Authenticated clients retain read-only access to their own installation rows.
-- Consequential mutations are reserved for the FastAPI backend via service_role.

alter table public.deployed_agents enable row level security;

revoke all on table public.deployed_agents from anon, authenticated, service_role;
grant select on table public.deployed_agents to authenticated;
grant select, insert, update, delete on table public.deployed_agents to service_role;

drop policy if exists "Users can insert own deployed agents" on public.deployed_agents;
drop policy if exists "Users can update own deployed agents" on public.deployed_agents;
drop policy if exists "Users can delete own deployed agents" on public.deployed_agents;
drop policy if exists "Admins can view all deployed agents" on public.deployed_agents;

drop policy if exists "Users can view own deployed agents" on public.deployed_agents;
create policy "Users can view own deployed agents"
on public.deployed_agents
for select
to authenticated
using ((select auth.uid()) = user_id);

comment on table public.deployed_agents is
  'Marketplace installations: authenticated clients are read-only; FastAPI/service_role owns consequential mutations and runtime state.';
