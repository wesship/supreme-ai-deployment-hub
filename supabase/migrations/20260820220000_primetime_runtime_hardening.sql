begin;

-- Avoid per-row auth.uid() evaluation in PRIMETIME RLS predicates.
drop policy if exists primetime_interactions_org_member on public.primetime_interactions;
create policy primetime_interactions_org_member on public.primetime_interactions
  for all to authenticated
  using (exists (select 1 from public.organization_members m where m.organization_id = primetime_interactions.organization_id and m.user_id = (select auth.uid())))
  with check (exists (select 1 from public.organization_members m where m.organization_id = primetime_interactions.organization_id and m.user_id = (select auth.uid())));

drop policy if exists primetime_dispatches_org_member on public.primetime_dispatches;
create policy primetime_dispatches_org_member on public.primetime_dispatches
  for all to authenticated
  using (exists (select 1 from public.organization_members m where m.organization_id = primetime_dispatches.organization_id and m.user_id = (select auth.uid())))
  with check (exists (select 1 from public.organization_members m where m.organization_id = primetime_dispatches.organization_id and m.user_id = (select auth.uid())));

drop policy if exists primetime_artifacts_org_member on public.primetime_artifacts;
create policy primetime_artifacts_org_member on public.primetime_artifacts
  for all to authenticated
  using (exists (select 1 from public.organization_members m where m.organization_id = primetime_artifacts.organization_id and m.user_id = (select auth.uid())))
  with check (exists (select 1 from public.organization_members m where m.organization_id = primetime_artifacts.organization_id and m.user_id = (select auth.uid())));

drop policy if exists primetime_transitions_org_member on public.primetime_governance_transitions;
create policy primetime_transitions_org_member on public.primetime_governance_transitions
  for select to authenticated
  using (exists (select 1 from public.organization_members m where m.organization_id = primetime_governance_transitions.organization_id and m.user_id = (select auth.uid())));

drop policy if exists primetime_idempotency_org_member on public.primetime_ingest_idempotency;
create policy primetime_idempotency_org_member on public.primetime_ingest_idempotency
  for select to authenticated
  using (exists (select 1 from public.organization_members m where m.organization_id = primetime_ingest_idempotency.organization_id and m.user_id = (select auth.uid())));

-- Cover each foreign key with a leading-column index for predictable joins/deletes.
create index if not exists primetime_interactions_lead_fk_idx on public.primetime_interactions(lead_id);
create index if not exists primetime_interactions_created_by_fk_idx on public.primetime_interactions(created_by);
create index if not exists primetime_dispatches_lead_fk_idx on public.primetime_dispatches(lead_id);
create index if not exists primetime_dispatches_interaction_fk_idx on public.primetime_dispatches(interaction_id);
create index if not exists primetime_artifacts_lead_fk_idx on public.primetime_artifacts(lead_id);
create index if not exists primetime_artifacts_interaction_fk_idx on public.primetime_artifacts(interaction_id);
create index if not exists primetime_artifacts_dispatch_fk_idx on public.primetime_artifacts(dispatch_id);
create index if not exists primetime_artifacts_approved_by_fk_idx on public.primetime_artifacts(approved_by);
create index if not exists primetime_transitions_lead_fk_idx on public.primetime_governance_transitions(lead_id);
create index if not exists primetime_transitions_dispatch_fk_idx on public.primetime_governance_transitions(dispatch_id);
create index if not exists primetime_transitions_actor_fk_idx on public.primetime_governance_transitions(actor_id);

commit;
