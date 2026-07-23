begin;

-- Correct admin role checks and restrict them to authenticated users.
do $$
declare
  target_table text;
begin
  foreach target_table in array array['ai_request_logs','tool_call_logs','agent_activity_logs','error_logs']
  loop
    execute format('drop policy if exists %I on public.%I', 'Admin read ' || target_table, target_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (((select auth.jwt()) -> ''app_metadata'' ->> ''role'') = ''admin'')',
      'Admin read ' || target_table,
      target_table
    );
  end loop;
end
$$;

-- User-owned conversation policies with init-plan-safe auth evaluation.
drop policy if exists "Users can view own conversations" on public.conversations;
drop policy if exists "Users can insert own conversations" on public.conversations;
drop policy if exists "Users can update own conversations" on public.conversations;
drop policy if exists "Users can delete own conversations" on public.conversations;
create policy "Users can view own conversations" on public.conversations for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own conversations" on public.conversations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own conversations" on public.conversations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own conversations" on public.conversations for delete to authenticated using ((select auth.uid()) = user_id);

-- User-owned deployed agent policies.
drop policy if exists "Users can view own deployed agents" on public.deployed_agents;
drop policy if exists "Users can insert own deployed agents" on public.deployed_agents;
drop policy if exists "Users can update own deployed agents" on public.deployed_agents;
drop policy if exists "Users can delete own deployed agents" on public.deployed_agents;
create policy "Users can view own deployed agents" on public.deployed_agents for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own deployed agents" on public.deployed_agents for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own deployed agents" on public.deployed_agents for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own deployed agents" on public.deployed_agents for delete to authenticated using ((select auth.uid()) = user_id);

-- Consolidate duplicate approval_queue policies into one policy per action.
drop policy if exists "Admin manage approvals" on public.approval_queue;
drop policy if exists "Users insert own approvals" on public.approval_queue;
drop policy if exists "Users read own approvals" on public.approval_queue;
create policy "Read own or admin approvals" on public.approval_queue for select to authenticated using (
  (select auth.uid()) = user_id
  or (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
);
create policy "Insert own or admin approvals" on public.approval_queue for insert to authenticated with check (
  (select auth.uid()) = user_id
  or (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
);
create policy "Admin update approvals" on public.approval_queue for update to authenticated using (
  (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
) with check (
  (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
);
create policy "Admin delete approvals" on public.approval_queue for delete to authenticated using (
  (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
);

-- Consolidate duplicate rag_documents policies into one policy per action.
drop policy if exists "Admin manage rag_documents" on public.rag_documents;
drop policy if exists "Users insert own rag_documents" on public.rag_documents;
drop policy if exists "Users read own rag_documents" on public.rag_documents;
create policy "Read own or admin rag_documents" on public.rag_documents for select to authenticated using (
  (select auth.uid()) = user_id
  or (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
);
create policy "Insert own or admin rag_documents" on public.rag_documents for insert to authenticated with check (
  (select auth.uid()) = user_id
  or (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
);
create policy "Admin update rag_documents" on public.rag_documents for update to authenticated using (
  (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
) with check (
  (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
);
create policy "Admin delete rag_documents" on public.rag_documents for delete to authenticated using (
  (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
);

-- Remove duplicate user_roles self-read policy and keep one optimized authenticated policy.
drop policy if exists "Users can read their own roles" on public.user_roles;
drop policy if exists "user_roles_self_select" on public.user_roles;
create policy "user_roles_self_select" on public.user_roles for select to authenticated using ((select auth.uid()) = user_id);

-- Optimize workspace membership policies.
do $$
declare
  target_table text;
  policy_name text;
begin
  foreach target_table in array array['appointments','appointment_attendees','availability_rules','reminders','no_show_events','calendar_sync_events']
  loop
    policy_name := target_table || '_workspace_members';
    execute format('drop policy if exists %I on public.%I', policy_name, target_table);
    execute format(
      'create policy %I on public.%I for all to authenticated using (exists (select 1 from public.primetime_workspace_memberships wm where wm.workspace_id = %I.workspace_id and wm.user_id = (select auth.uid()) and wm.status = ''active'')) with check (exists (select 1 from public.primetime_workspace_memberships wm where wm.workspace_id = %I.workspace_id and wm.user_id = (select auth.uid()) and wm.status = ''active''))',
      policy_name,
      target_table,
      target_table,
      target_table
    );
  end loop;
end
$$;

commit;
