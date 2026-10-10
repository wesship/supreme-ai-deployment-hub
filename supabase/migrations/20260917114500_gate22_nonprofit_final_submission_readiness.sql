create or replace view public.nonprofit_submission_readiness_v1
with (security_invoker = true)
as
with attachment_summary as (
  select
    organization_id,
    workflow_id,
    count(*) as attachment_requirements,
    count(*) filter (where validation_status = 'VALID') as valid_attachments,
    count(*) filter (where hard_blocker) as attachment_blockers
  from public.nonprofit_attachment_compliance_v1
  group by organization_id, workflow_id
),
approval_summary as (
  select
    organization_id,
    resource_id as workflow_id,
    count(*) filter (where status = 'PENDING') as pending_approvals,
    count(*) filter (where status = 'REJECTED') as rejected_approvals
  from public.nonprofit_pending_approvals_v1
  where resource_id is not null
  group by organization_id, resource_id
),
policy_summary as (
  select
    organization_id,
    resource_id as workflow_id,
    count(*) filter (where decision = 'RED') as red_policy_blocks,
    count(*) filter (where decision = 'YELLOW') as yellow_policy_warnings
  from public.nonprofit_compliance_alerts_v1
  where resource_id is not null
  group by organization_id, resource_id
)
select
  g.workflow_id,
  g.organization_id,
  g.opportunity_id,
  g.funder_name,
  g.title,
  g.deadline,
  g.stage,
  g.workflow_status,
  g.readiness_score,
  g.go_no_go,
  g.submitted_at,
  coalesce(a.attachment_requirements, 0) as attachment_requirements,
  coalesce(a.valid_attachments, 0) as valid_attachments,
  coalesce(a.attachment_blockers, 0) as attachment_blockers,
  coalesce(ap.pending_approvals, 0) as pending_approvals,
  coalesce(ap.rejected_approvals, 0) as rejected_approvals,
  coalesce(p.red_policy_blocks, 0) as red_policy_blocks,
  coalesce(p.yellow_policy_warnings, 0) as yellow_policy_warnings,
  case
    when g.submitted_at is not null then 'SUBMITTED'
    when g.deadline is not null and g.deadline < current_date then 'BLOCKED_DEADLINE'
    when g.go_no_go is null then 'BLOCKED_GO_NO_GO_REQUIRED'
    when upper(replace(g.go_no_go, '-', '_')) in ('NO_GO','RED','REJECT','REJECTED','INELIGIBLE') then 'BLOCKED_ELIGIBILITY'
    when g.readiness_score is null then 'BLOCKED_READINESS_UNKNOWN'
    when g.readiness_score < 100 then 'BLOCKED_READINESS_INCOMPLETE'
    when coalesce(a.attachment_blockers, 0) > 0 then 'BLOCKED_ATTACHMENTS'
    when coalesce(ap.rejected_approvals, 0) > 0 then 'BLOCKED_REJECTED_APPROVAL'
    when coalesce(ap.pending_approvals, 0) > 0 then 'BLOCKED_PENDING_APPROVAL'
    when coalesce(p.red_policy_blocks, 0) > 0 then 'BLOCKED_POLICY'
    else 'SUBMISSION_READY'
  end as submission_status,
  jsonb_strip_nulls(jsonb_build_object(
    'deadline', case when g.deadline is not null and g.deadline < current_date then 'deadline_passed' end,
    'eligibility', case
      when g.go_no_go is null then 'go_no_go_missing'
      when upper(replace(g.go_no_go, '-', '_')) in ('NO_GO','RED','REJECT','REJECTED','INELIGIBLE') then 'eligibility_blocked'
    end,
    'readiness', case
      when g.readiness_score is null then 'readiness_unknown'
      when g.readiness_score < 100 then 'readiness_incomplete'
    end,
    'attachments', case when coalesce(a.attachment_blockers, 0) > 0 then coalesce(a.attachment_blockers, 0)::text || '_blockers' end,
    'approvals', case
      when coalesce(ap.rejected_approvals, 0) > 0 then coalesce(ap.rejected_approvals, 0)::text || '_rejected'
      when coalesce(ap.pending_approvals, 0) > 0 then coalesce(ap.pending_approvals, 0)::text || '_pending'
    end,
    'policy', case when coalesce(p.red_policy_blocks, 0) > 0 then coalesce(p.red_policy_blocks, 0)::text || '_red_blocks' end
  )) as blocker_reasons,
  case
    when g.submitted_at is not null then false
    when g.deadline is not null and g.deadline < current_date then true
    when g.go_no_go is null then true
    when upper(replace(g.go_no_go, '-', '_')) in ('NO_GO','RED','REJECT','REJECTED','INELIGIBLE') then true
    when g.readiness_score is null or g.readiness_score < 100 then true
    when coalesce(a.attachment_blockers, 0) > 0 then true
    when coalesce(ap.rejected_approvals, 0) > 0 then true
    when coalesce(ap.pending_approvals, 0) > 0 then true
    when coalesce(p.red_policy_blocks, 0) > 0 then true
    else false
  end as hard_blocker
from public.nonprofit_grant_pipeline_v1 g
left join attachment_summary a
  on a.organization_id = g.organization_id and a.workflow_id = g.workflow_id
left join approval_summary ap
  on ap.organization_id = g.organization_id and ap.workflow_id = g.workflow_id
left join policy_summary p
  on p.organization_id = g.organization_id and p.workflow_id = g.workflow_id;

grant select on public.nonprofit_submission_readiness_v1 to authenticated;
revoke all on public.nonprofit_submission_readiness_v1 from anon;
