create table if not exists nonprofit.grant_attachment_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workflow_id uuid not null,
  requirement_name text not null,
  required boolean not null default true,
  allowed_formats text[] not null default '{}',
  max_file_size_mb numeric,
  max_pages integer,
  must_be_signed boolean not null default false,
  must_be_current boolean not null default false,
  max_age_days integer,
  conditional_rule jsonb,
  source_requirement text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (max_file_size_mb is null or max_file_size_mb > 0),
  check (max_pages is null or max_pages > 0),
  check (max_age_days is null or max_age_days > 0)
);

create table if not exists nonprofit.grant_attachment_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workflow_id uuid not null,
  requirement_id uuid not null references nonprofit.grant_attachment_requirements(id) on delete cascade,
  document_reference uuid,
  document_name text,
  source_kind text not null default 'VAULT',
  mime_type text,
  file_size_mb numeric,
  page_count integer,
  document_date date,
  expires_at date,
  signature_required boolean not null default false,
  signature_verified boolean,
  content_verified boolean not null default false,
  content_match_confidence numeric,
  validation_notes text,
  validated_by uuid,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requirement_id),
  check (source_kind in ('VAULT','UPLOAD','GENERATED')),
  check (file_size_mb is null or file_size_mb >= 0),
  check (page_count is null or page_count >= 0),
  check (content_match_confidence is null or (content_match_confidence >= 0 and content_match_confidence <= 1))
);

alter table nonprofit.grant_attachment_requirements enable row level security;
alter table nonprofit.grant_attachment_matches enable row level security;

create policy grant_attachment_requirements_member_read
on nonprofit.grant_attachment_requirements
for select to authenticated
using (
  exists (
    select 1 from nonprofit_security.memberships m
    where m.organization_id = grant_attachment_requirements.organization_id
      and m.user_id = auth.uid()
      and m.active
  )
);

create policy grant_attachment_matches_member_read
on nonprofit.grant_attachment_matches
for select to authenticated
using (
  exists (
    select 1 from nonprofit_security.memberships m
    where m.organization_id = grant_attachment_matches.organization_id
      and m.user_id = auth.uid()
      and m.active
  )
);

create or replace view public.nonprofit_attachment_compliance_v1
with (security_invoker = true)
as
select
  r.id as requirement_id,
  r.organization_id,
  r.workflow_id,
  r.requirement_name,
  r.required,
  r.allowed_formats,
  r.max_file_size_mb,
  r.max_pages,
  r.must_be_signed,
  r.must_be_current,
  r.max_age_days,
  r.source_requirement,
  m.id as match_id,
  m.document_reference,
  m.document_name,
  m.source_kind,
  m.mime_type,
  m.file_size_mb,
  m.page_count,
  m.document_date,
  m.expires_at,
  m.signature_verified,
  m.content_verified,
  m.content_match_confidence,
  m.validation_notes,
  case
    when m.id is null and r.required then 'BLOCKED_MISSING'
    when m.id is null then 'OPTIONAL_MISSING'
    when not m.content_verified then 'BLOCKED_UNVERIFIED_CONTENT'
    when r.must_be_signed and coalesce(m.signature_verified, false) = false then 'BLOCKED_UNSIGNED'
    when r.must_be_current and m.expires_at is not null and m.expires_at < current_date then 'BLOCKED_EXPIRED'
    when r.must_be_current and r.max_age_days is not null and m.document_date is not null and m.document_date < (current_date - r.max_age_days) then 'BLOCKED_STALE'
    when r.max_file_size_mb is not null and m.file_size_mb is not null and m.file_size_mb > r.max_file_size_mb then 'BLOCKED_FILE_SIZE'
    when r.max_pages is not null and m.page_count is not null and m.page_count > r.max_pages then 'BLOCKED_PAGE_COUNT'
    when cardinality(r.allowed_formats) > 0 and m.mime_type is not null and not (
      lower(m.mime_type) = any (select lower(x) from unnest(r.allowed_formats) as x)
    ) then 'BLOCKED_FILE_TYPE'
    else 'VALID'
  end as validation_status,
  case
    when m.id is null and r.required then true
    when m.id is null then false
    when not m.content_verified then true
    when r.must_be_signed and coalesce(m.signature_verified, false) = false then true
    when r.must_be_current and m.expires_at is not null and m.expires_at < current_date then true
    when r.must_be_current and r.max_age_days is not null and m.document_date is not null and m.document_date < (current_date - r.max_age_days) then true
    when r.max_file_size_mb is not null and m.file_size_mb is not null and m.file_size_mb > r.max_file_size_mb then true
    when r.max_pages is not null and m.page_count is not null and m.page_count > r.max_pages then true
    when cardinality(r.allowed_formats) > 0 and m.mime_type is not null and not (
      lower(m.mime_type) = any (select lower(x) from unnest(r.allowed_formats) as x)
    ) then true
    else false
  end as hard_blocker
from nonprofit.grant_attachment_requirements r
left join nonprofit.grant_attachment_matches m on m.requirement_id = r.id;

grant select on public.nonprofit_attachment_compliance_v1 to authenticated;
revoke all on public.nonprofit_attachment_compliance_v1 from anon;
