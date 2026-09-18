create table if not exists nonprofit.submission_preview_certifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workflow_id uuid not null,
  preview_id uuid not null references nonprofit.submission_previews(id),
  authorization_id uuid not null references nonprofit.submission_authorizations(id),
  certified_payload_hash text not null,
  frozen_payload jsonb not null,
  frozen_attachment_manifest jsonb not null,
  frozen_readiness_snapshot jsonb not null,
  connector_kind text not null,
  certified_by uuid not null,
  certified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'CERTIFIED',
  certification_notes text,
  created_at timestamptz not null default now(),
  check (status = 'CERTIFIED')
);

create unique index if not exists submission_preview_certifications_one_per_preview
on nonprofit.submission_preview_certifications(preview_id);

alter table nonprofit.submission_preview_certifications enable row level security;

create policy submission_preview_certifications_member_read
on nonprofit.submission_preview_certifications
for select to authenticated
using (
  exists (
    select 1
    from nonprofit_security.memberships m
    where m.organization_id = submission_preview_certifications.organization_id
      and m.user_id = auth.uid()
      and m.active
  )
);

revoke insert, update, delete on nonprofit.submission_preview_certifications from authenticated;
grant select on nonprofit.submission_preview_certifications to authenticated;

create or replace view public.nonprofit_submission_preview_fingerprints_v1
with (security_invoker = true)
as
with current_attachments as (
  select
    c.organization_id,
    c.workflow_id,
    coalesce(
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
    ) as attachment_manifest,
    count(*) filter (where c.hard_blocker) as attachment_blockers
  from public.nonprofit_attachment_compliance_v1 c
  group by c.organization_id, c.workflow_id
),
current_state as (
  select
    p.id as preview_id,
    p.organization_id,
    p.workflow_id,
    p.authorization_id,
    p.connector_kind,
    p.payload_hash as stored_payload_hash,
    p.generated_by,
    p.generated_at,
    p.authorization_expires_at,
    p.payload as stored_payload,
    p.attachment_manifest as stored_attachment_manifest,
    p.readiness_snapshot as stored_readiness_snapshot,
    r.submission_status,
    r.hard_blocker,
    r.opportunity_id,
    r.funder_name,
    r.title,
    r.deadline,
    r.readiness_score,
    r.go_no_go,
    r.attachment_requirements,
    r.valid_attachments,
    r.attachment_blockers,
    r.pending_approvals,
    r.rejected_approvals,
    r.red_policy_blocks,
    r.yellow_policy_warnings,
    a.decided_by as authorization_decided_by,
    a.decided_at as authorization_decided_at,
    a.expires_at as current_authorization_expires_at,
    a.status as authorization_status,
    coalesce(ca.attachment_manifest, '[]'::jsonb) as current_attachment_manifest,
    coalesce(ca.attachment_blockers, 0) as current_attachment_blockers
  from nonprofit.submission_previews p
  join public.nonprofit_submission_readiness_v1 r
    on r.organization_id = p.organization_id
   and r.workflow_id = p.workflow_id
  join nonprofit.submission_authorizations a
    on a.id = p.authorization_id
   and a.organization_id = p.organization_id
   and a.workflow_id = p.workflow_id
  left join current_attachments ca
    on ca.organization_id = p.organization_id
   and ca.workflow_id = p.workflow_id
),
rebuilt as (
  select
    s.*,
    jsonb_build_object(
      'submission_status', s.submission_status,
      'readiness_score', s.readiness_score,
      'go_no_go', s.go_no_go,
      'deadline', s.deadline,
      'attachment_requirements', s.attachment_requirements,
      'valid_attachments', s.valid_attachments,
      'attachment_blockers', s.attachment_blockers,
      'pending_approvals', s.pending_approvals,
      'rejected_approvals', s.rejected_approvals,
      'red_policy_blocks', s.red_policy_blocks,
      'yellow_policy_warnings', s.yellow_policy_warnings
    ) as current_readiness_snapshot
  from current_state s
),
payloads as (
  select
    r.*,
    jsonb_build_object(
      'schema_version', 'grantassist.submission-preview.v1',
      'mode', 'DRY_RUN',
      'connector_kind', r.connector_kind,
      'workflow_id', r.workflow_id,
      'organization_id', r.organization_id,
      'opportunity_id', r.opportunity_id,
      'funder_name', r.funder_name,
      'title', r.title,
      'deadline', r.deadline,
      'authorization_id', r.authorization_id,
      'authorization_decided_by', r.authorization_decided_by,
      'authorization_decided_at', r.authorization_decided_at,
      'authorization_expires_at', r.current_authorization_expires_at,
      'readiness', r.current_readiness_snapshot,
      'attachments', r.current_attachment_manifest
    ) as current_payload
  from rebuilt r
)
select
  p.preview_id,
  p.organization_id,
  p.workflow_id,
  p.authorization_id,
  p.connector_kind,
  p.stored_payload_hash,
  encode(extensions.digest(convert_to(p.current_payload::text, 'UTF8'), 'sha256'), 'hex') as current_payload_hash,
  p.stored_payload,
  p.current_payload,
  p.stored_attachment_manifest,
  p.current_attachment_manifest,
  p.stored_readiness_snapshot,
  p.current_readiness_snapshot,
  p.generated_by,
  p.generated_at,
  p.authorization_expires_at,
  p.current_authorization_expires_at,
  p.authorization_status,
  (p.authorization_status = 'APPROVED' and p.current_authorization_expires_at > now()) as authorization_still_live,
  (p.submission_status = 'SUBMISSION_READY' and not p.hard_blocker and p.current_attachment_blockers = 0) as readiness_still_valid,
  (
    p.stored_payload_hash =
    encode(extensions.digest(convert_to(p.current_payload::text, 'UTF8'), 'sha256'), 'hex')
  ) as package_unchanged
from payloads p;

grant select on public.nonprofit_submission_preview_fingerprints_v1 to authenticated;
revoke all on public.nonprofit_submission_preview_fingerprints_v1 from anon;

create or replace function nonprofit_api.certify_submission_preview(
  p_preview_id uuid,
  p_expected_payload_hash text,
  p_notes text default null
)
returns table (
  certification_id uuid,
  certification_status text,
  certified_payload_hash text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_aal text := (select auth.jwt() ->> 'aal');
  v_preview record;
  v_cert_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_event_at timestamptz := now();
  v_prev_hash text;
  v_event_hash text;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if v_aal is distinct from 'aal2' then
    raise exception 'MFA_AAL2_REQUIRED' using errcode = '42501';
  end if;

  select f.* into v_preview
  from public.nonprofit_submission_preview_fingerprints_v1 f
  where f.preview_id = p_preview_id;

  if not found then
    raise exception 'PREVIEW_NOT_FOUND_OR_NOT_VISIBLE' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from nonprofit_security.memberships m
    where m.organization_id = v_preview.organization_id
      and m.user_id = v_user
      and m.active
      and m.can_approve
  ) then
    raise exception 'CERTIFIER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if v_preview.generated_by = v_user then
    raise exception 'SEPARATION_OF_DUTIES_REQUIRED' using errcode = '42501';
  end if;

  if p_expected_payload_hash is null or p_expected_payload_hash <> v_preview.stored_payload_hash then
    raise exception 'EXPECTED_PAYLOAD_HASH_MISMATCH' using errcode = '22023';
  end if;

  if v_preview.stored_payload_hash <> v_preview.current_payload_hash or not v_preview.package_unchanged then
    raise exception 'PREVIEW_PACKAGE_CHANGED_REGENERATE_REQUIRED' using errcode = '42501';
  end if;

  if not v_preview.authorization_still_live then
    raise exception 'LIVE_HUMAN_AUTHORIZATION_REQUIRED' using errcode = '42501';
  end if;

  if not v_preview.readiness_still_valid then
    raise exception 'READINESS_CHANGED_REGENERATE_REQUIRED' using errcode = '42501';
  end if;

  if exists (
    select 1
    from nonprofit.submission_preview_certifications c
    where c.preview_id = p_preview_id
  ) then
    raise exception 'PREVIEW_ALREADY_CERTIFIED' using errcode = '55000';
  end if;

  insert into nonprofit.submission_preview_certifications (
    id,
    organization_id,
    workflow_id,
    preview_id,
    authorization_id,
    certified_payload_hash,
    frozen_payload,
    frozen_attachment_manifest,
    frozen_readiness_snapshot,
    connector_kind,
    certified_by,
    certified_at,
    expires_at,
    certification_notes
  ) values (
    v_cert_id,
    v_preview.organization_id,
    v_preview.workflow_id,
    v_preview.preview_id,
    v_preview.authorization_id,
    v_preview.stored_payload_hash,
    v_preview.stored_payload,
    v_preview.stored_attachment_manifest,
    v_preview.stored_readiness_snapshot,
    v_preview.connector_kind,
    v_user,
    v_event_at,
    v_preview.current_authorization_expires_at,
    nullif(btrim(p_notes), '')
  );

  select ae.event_hash into v_prev_hash
  from nonprofit_security.audit_events ae
  where ae.organization_id = v_preview.organization_id
  order by ae.event_at desc, ae.id desc
  limit 1;

  v_event_hash := encode(extensions.digest(
    concat_ws('|',
      coalesce(v_prev_hash,''),
      v_event_id::text,
      v_preview.organization_id::text,
      v_event_at::text,
      'USER',
      v_user::text,
      'SUBMISSION_PREVIEW_CERTIFIED',
      v_cert_id::text,
      v_preview.stored_payload_hash,
      v_preview.connector_kind
    )::bytea,
    'sha256'
  ), 'hex');

  insert into nonprofit_security.audit_events (
    id, organization_id, event_at, actor_type, actor_id, event_type,
    resource_type, resource_id, action, result, previous_event_hash, event_hash
  ) values (
    v_event_id, v_preview.organization_id, v_event_at, 'USER', v_user,
    'SUBMISSION_PREVIEW_CERTIFIED', 'submission_preview_certification', v_cert_id,
    'CERTIFY_HASH', v_preview.stored_payload_hash, v_prev_hash, v_event_hash
  );

  return query
  select v_cert_id, 'CERTIFIED'::text, v_preview.stored_payload_hash, v_preview.current_authorization_expires_at;
end;
$$;

revoke all on function nonprofit_api.certify_submission_preview(uuid,text,text) from public;
revoke all on function nonprofit_api.certify_submission_preview(uuid,text,text) from anon;
grant execute on function nonprofit_api.certify_submission_preview(uuid,text,text) to authenticated;

create or replace function public.nonprofit_certify_submission_preview(
  p_preview_id uuid,
  p_expected_payload_hash text,
  p_notes text default null
)
returns table (
  certification_id uuid,
  certification_status text,
  certified_payload_hash text,
  expires_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from nonprofit_api.certify_submission_preview(
    p_preview_id,
    p_expected_payload_hash,
    p_notes
  );
$$;

revoke all on function public.nonprofit_certify_submission_preview(uuid,text,text) from public;
revoke all on function public.nonprofit_certify_submission_preview(uuid,text,text) from anon;
grant execute on function public.nonprofit_certify_submission_preview(uuid,text,text) to authenticated;

create or replace view public.nonprofit_submission_preview_certifications_v1
with (security_invoker = true)
as
select
  c.id as certification_id,
  c.organization_id,
  c.workflow_id,
  c.preview_id,
  c.authorization_id,
  f.connector_kind,
  f.stored_payload_hash as preview_payload_hash,
  f.current_payload_hash,
  c.certified_payload_hash,
  c.certified_by,
  c.certified_at,
  c.expires_at,
  c.certification_notes,
  f.authorization_still_live,
  f.readiness_still_valid,
  f.package_unchanged,
  (
    c.certified_payload_hash = f.stored_payload_hash
    and c.certified_payload_hash = f.current_payload_hash
  ) as hash_still_matches,
  case
    when c.expires_at <= now() then 'INVALID_AUTHORIZATION_EXPIRED'
    when not f.authorization_still_live then 'INVALID_AUTHORIZATION'
    when not f.readiness_still_valid then 'INVALID_READINESS_CHANGED'
    when not f.package_unchanged then 'INVALID_PACKAGE_CHANGED'
    when c.certified_payload_hash <> f.stored_payload_hash then 'INVALID_PREVIEW_HASH_CHANGED'
    when c.certified_payload_hash <> f.current_payload_hash then 'INVALID_CURRENT_HASH_CHANGED'
    else 'CERTIFIED_VALID'
  end as certification_status,
  (
    c.expires_at > now()
    and f.authorization_still_live
    and f.readiness_still_valid
    and f.package_unchanged
    and c.certified_payload_hash = f.stored_payload_hash
    and c.certified_payload_hash = f.current_payload_hash
  ) as certification_valid,
  c.frozen_payload,
  c.frozen_attachment_manifest,
  c.frozen_readiness_snapshot
from nonprofit.submission_preview_certifications c
join public.nonprofit_submission_preview_fingerprints_v1 f
  on f.preview_id = c.preview_id
 and f.organization_id = c.organization_id
 and f.workflow_id = c.workflow_id
 and f.authorization_id = c.authorization_id;

grant select on public.nonprofit_submission_preview_certifications_v1 to authenticated;
revoke all on public.nonprofit_submission_preview_certifications_v1 from anon;
