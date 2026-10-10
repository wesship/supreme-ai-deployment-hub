create table if not exists nonprofit.submission_previews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workflow_id uuid not null,
  authorization_id uuid not null references nonprofit.submission_authorizations(id),
  connector_kind text not null default 'MANUAL_PACKAGE',
  payload jsonb not null,
  payload_hash text not null,
  attachment_manifest jsonb not null default '[]'::jsonb,
  generated_by uuid not null,
  generated_at timestamptz not null default now(),
  authorization_expires_at timestamptz not null,
  readiness_snapshot jsonb not null,
  status text not null default 'PREVIEW',
  created_at timestamptz not null default now(),
  check (connector_kind in ('MANUAL_PACKAGE','GRANTS_GOV_PREVIEW','FUNDER_PORTAL_PREVIEW')),
  check (status = 'PREVIEW')
);

create unique index if not exists submission_previews_hash_per_workflow
on nonprofit.submission_previews(workflow_id, payload_hash);

alter table nonprofit.submission_previews enable row level security;

create policy submission_previews_member_read
on nonprofit.submission_previews
for select to authenticated
using (
  exists (
    select 1
    from nonprofit_security.memberships m
    where m.organization_id = submission_previews.organization_id
      and m.user_id = auth.uid()
      and m.active
  )
);

revoke insert, update, delete on nonprofit.submission_previews from authenticated;
grant select on nonprofit.submission_previews to authenticated;

create or replace function nonprofit_api.generate_submission_preview(
  p_workflow_id uuid,
  p_connector_kind text default 'MANUAL_PACKAGE'
)
returns table (
  preview_id uuid,
  payload_hash text,
  preview_status text,
  authorization_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_ready record;
  v_auth nonprofit.submission_authorizations%rowtype;
  v_manifest jsonb;
  v_payload jsonb;
  v_readiness jsonb;
  v_hash text;
  v_preview_id uuid;
  v_event_id uuid := gen_random_uuid();
  v_event_at timestamptz := now();
  v_prev_hash text;
  v_event_hash text;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if p_connector_kind not in ('MANUAL_PACKAGE','GRANTS_GOV_PREVIEW','FUNDER_PORTAL_PREVIEW') then
    raise exception 'INVALID_CONNECTOR_KIND' using errcode = '22023';
  end if;

  select r.* into v_ready
  from public.nonprofit_submission_readiness_v1 r
  where r.workflow_id = p_workflow_id;

  if not found then
    raise exception 'WORKFLOW_NOT_FOUND_OR_NOT_VISIBLE' using errcode = 'P0002';
  end if;

  if v_ready.submission_status <> 'SUBMISSION_READY' or v_ready.hard_blocker then
    raise exception 'WORKFLOW_NOT_SUBMISSION_READY' using errcode = '42501';
  end if;

  select a.* into v_auth
  from nonprofit.submission_authorizations a
  where a.workflow_id = p_workflow_id
    and a.organization_id = v_ready.organization_id
    and a.status = 'APPROVED'
    and a.expires_at > now()
  order by a.decided_at desc
  limit 1;

  if not found then
    raise exception 'LIVE_HUMAN_AUTHORIZATION_REQUIRED' using errcode = '42501';
  end if;

  if not exists (
    select 1 from nonprofit_security.memberships m
    where m.organization_id = v_ready.organization_id
      and m.user_id = v_user
      and m.active
  ) then
    raise exception 'ACTIVE_MEMBERSHIP_REQUIRED' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'requirement_id', c.requirement_id,
        'requirement_name', c.requirement_name,
        'required', c.required,
        'document_reference', c.document_reference,
        'document_name', c.document_name,
        'mime_type', c.mime_type,
        'page_count', c.page_count,
        'validation_status', c.validation_status,
        'content_verified', c.content_verified,
        'signature_verified', c.signature_verified
      )
      order by c.requirement_name, c.requirement_id
    ),
    '[]'::jsonb
  ) into v_manifest
  from public.nonprofit_attachment_compliance_v1 c
  where c.workflow_id = p_workflow_id
    and c.organization_id = v_ready.organization_id;

  if exists (
    select 1 from public.nonprofit_attachment_compliance_v1 c
    where c.workflow_id = p_workflow_id
      and c.organization_id = v_ready.organization_id
      and c.hard_blocker
  ) then
    raise exception 'ATTACHMENT_COMPLIANCE_CHANGED' using errcode = '42501';
  end if;

  v_readiness := jsonb_build_object(
    'submission_status', v_ready.submission_status,
    'readiness_score', v_ready.readiness_score,
    'go_no_go', v_ready.go_no_go,
    'deadline', v_ready.deadline,
    'attachment_requirements', v_ready.attachment_requirements,
    'valid_attachments', v_ready.valid_attachments,
    'attachment_blockers', v_ready.attachment_blockers,
    'pending_approvals', v_ready.pending_approvals,
    'rejected_approvals', v_ready.rejected_approvals,
    'red_policy_blocks', v_ready.red_policy_blocks,
    'yellow_policy_warnings', v_ready.yellow_policy_warnings
  );

  v_payload := jsonb_build_object(
    'schema_version', 'grantassist.submission-preview.v1',
    'mode', 'DRY_RUN',
    'connector_kind', p_connector_kind,
    'workflow_id', v_ready.workflow_id,
    'organization_id', v_ready.organization_id,
    'opportunity_id', v_ready.opportunity_id,
    'funder_name', v_ready.funder_name,
    'title', v_ready.title,
    'deadline', v_ready.deadline,
    'authorization_id', v_auth.id,
    'authorization_decided_by', v_auth.decided_by,
    'authorization_decided_at', v_auth.decided_at,
    'authorization_expires_at', v_auth.expires_at,
    'readiness', v_readiness,
    'attachments', v_manifest
  );

  v_hash := encode(extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex');

  insert into nonprofit.submission_previews (
    organization_id, workflow_id, authorization_id, connector_kind,
    payload, payload_hash, attachment_manifest, generated_by,
    authorization_expires_at, readiness_snapshot
  ) values (
    v_ready.organization_id, p_workflow_id, v_auth.id, p_connector_kind,
    v_payload, v_hash, v_manifest, v_user,
    v_auth.expires_at, v_readiness
  )
  on conflict (workflow_id, payload_hash) do update
    set generated_by = excluded.generated_by,
        generated_at = now(),
        authorization_id = excluded.authorization_id,
        authorization_expires_at = excluded.authorization_expires_at
  returning id into v_preview_id;

  select ae.event_hash into v_prev_hash
  from nonprofit_security.audit_events ae
  where ae.organization_id = v_ready.organization_id
  order by ae.event_at desc, ae.id desc
  limit 1;

  v_event_hash := encode(extensions.digest(
    concat_ws('|',
      coalesce(v_prev_hash,''),
      v_event_id::text,
      v_ready.organization_id::text,
      v_event_at::text,
      'USER',
      v_user::text,
      'SUBMISSION_PREVIEW_GENERATED',
      v_preview_id::text,
      v_hash,
      p_connector_kind
    )::bytea,
    'sha256'
  ), 'hex');

  insert into nonprofit_security.audit_events (
    id, organization_id, event_at, actor_type, actor_id, event_type,
    resource_type, resource_id, action, result, previous_event_hash, event_hash
  ) values (
    v_event_id, v_ready.organization_id, v_event_at, 'USER', v_user,
    'SUBMISSION_PREVIEW_GENERATED', 'submission_preview', v_preview_id,
    'DRY_RUN', v_hash, v_prev_hash, v_event_hash
  );

  return query select v_preview_id, v_hash, 'PREVIEW'::text, v_auth.expires_at;
end;
$$;

revoke all on function nonprofit_api.generate_submission_preview(uuid,text) from public;
revoke all on function nonprofit_api.generate_submission_preview(uuid,text) from anon;
grant execute on function nonprofit_api.generate_submission_preview(uuid,text) to authenticated;

create or replace function public.nonprofit_generate_submission_preview(
  p_workflow_id uuid,
  p_connector_kind text default 'MANUAL_PACKAGE'
)
returns table (
  preview_id uuid,
  payload_hash text,
  preview_status text,
  authorization_expires_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from nonprofit_api.generate_submission_preview(p_workflow_id, p_connector_kind);
$$;

revoke all on function public.nonprofit_generate_submission_preview(uuid,text) from public;
revoke all on function public.nonprofit_generate_submission_preview(uuid,text) from anon;
grant execute on function public.nonprofit_generate_submission_preview(uuid,text) to authenticated;

create or replace view public.nonprofit_submission_previews_v1
with (security_invoker = true)
as
select
  p.id as preview_id,
  p.organization_id,
  p.workflow_id,
  r.funder_name,
  r.title,
  p.authorization_id,
  p.connector_kind,
  p.payload_hash,
  p.payload,
  p.attachment_manifest,
  p.generated_by,
  p.generated_at,
  p.authorization_expires_at,
  p.readiness_snapshot,
  p.status,
  (p.authorization_expires_at > now()) as authorization_still_live,
  (r.submission_status = 'SUBMISSION_READY' and not r.hard_blocker) as readiness_still_valid,
  false as external_transmission_performed
from nonprofit.submission_previews p
join public.nonprofit_submission_readiness_v1 r
  on r.organization_id = p.organization_id
 and r.workflow_id = p.workflow_id;

grant select on public.nonprofit_submission_previews_v1 to authenticated;
revoke all on public.nonprofit_submission_previews_v1 from anon;
