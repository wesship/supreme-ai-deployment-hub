-- Restrict internal Genesis tables to read-only project visibility for authenticated
-- members. Mutations flow through the trusted FastAPI service role and audited APIs.

-- Event history is readable; event creation and outbox mutation are backend-only.
drop policy if exists genesis_domain_events_project_access on public.genesis_domain_events;
create policy genesis_domain_events_select
on public.genesis_domain_events
for select
using (public.genesis_has_project_access(project_id));

drop policy if exists genesis_event_outbox_project_access on public.genesis_event_outbox;

-- Provider jobs and quarantined outputs are created only by the gateway workers.
drop policy if exists genesis_provider_jobs_access on public.genesis_provider_jobs;
create policy genesis_provider_jobs_select
on public.genesis_provider_jobs
for select
using (
  exists (
    select 1 from public.genesis_render_requests r
    where r.id = render_request_id and public.genesis_has_project_access(r.project_id)
  )
);

drop policy if exists genesis_provider_outputs_access on public.genesis_provider_outputs;
create policy genesis_provider_outputs_select
on public.genesis_provider_outputs
for select
using (
  exists (
    select 1
    from public.genesis_provider_jobs j
    join public.genesis_render_requests r on r.id = j.render_request_id
    where j.id = provider_job_id and public.genesis_has_project_access(r.project_id)
  )
);

-- Execution internals are observable but changed only by Hermes and workers.
drop policy if exists genesis_executions_access on public.genesis_executions;
create policy genesis_executions_select
on public.genesis_executions
for select
using (
  exists (
    select 1 from public.genesis_tasks t
    where t.id = task_id and public.genesis_has_project_access(t.project_id)
  )
);

drop policy if exists genesis_checkpoints_access on public.genesis_execution_checkpoints;
create policy genesis_checkpoints_select
on public.genesis_execution_checkpoints
for select
using (
  exists (
    select 1
    from public.genesis_executions e
    join public.genesis_tasks t on t.id = e.task_id
    where e.id = execution_id and public.genesis_has_project_access(t.project_id)
  )
);

drop policy if exists genesis_workflow_steps_access on public.genesis_workflow_steps;
create policy genesis_workflow_steps_select
on public.genesis_workflow_steps
for select
using (
  exists (
    select 1 from public.genesis_workflow_runs w
    where w.id = workflow_run_id and public.genesis_has_project_access(w.project_id)
  )
);

-- Locked canon and approvals may be read by collaborators, but direct mutations are
-- restricted to project owners. The API applies additional review and state rules.
drop policy if exists genesis_canon_entries_project_access on public.genesis_canon_entries;
create policy genesis_canon_select
on public.genesis_canon_entries
for select
using (public.genesis_has_project_access(project_id));
create policy genesis_canon_owner_insert
on public.genesis_canon_entries
for insert
with check (
  exists (select 1 from public.genesis_projects p where p.id = project_id and p.owner_id = auth.uid())
);
create policy genesis_canon_owner_update
on public.genesis_canon_entries
for update
using (
  exists (select 1 from public.genesis_projects p where p.id = project_id and p.owner_id = auth.uid())
)
with check (
  exists (select 1 from public.genesis_projects p where p.id = project_id and p.owner_id = auth.uid())
);
create policy genesis_canon_owner_delete
on public.genesis_canon_entries
for delete
using (
  exists (select 1 from public.genesis_projects p where p.id = project_id and p.owner_id = auth.uid())
  and locked = false
);

drop policy if exists genesis_approvals_project_access on public.genesis_approvals;
create policy genesis_approvals_select
on public.genesis_approvals
for select
using (public.genesis_has_project_access(project_id));

-- Render requests are visible to project members but are created and transitioned by
-- the gateway API so budgets and idempotency cannot be bypassed.
drop policy if exists genesis_render_requests_project_access on public.genesis_render_requests;
create policy genesis_render_requests_select
on public.genesis_render_requests
for select
using (public.genesis_has_project_access(project_id));

comment on table public.genesis_event_outbox is
  'Backend-only transactional outbox. No authenticated user mutation policy is installed.';
