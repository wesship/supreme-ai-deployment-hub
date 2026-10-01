create table if not exists nonprofit.production_release_attestations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  subject_ref text not null,
  attestation_type text not null,
  attestation_ref text not null,
  status text not null,
  details jsonb not null default '{}'::jsonb,
  attested_by text not null,
  attested_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (attestation_type in ('CI','CONFIG')),
  check (status in ('GREEN','RED'))
);

create unique index if not exists production_release_attestations_subject_type
on nonprofit.production_release_attestations(organization_id, subject_ref, attestation_type);

create table if not exists nonprofit.production_release_certification_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  promotion_id uuid not null,
  shadow_run_id uuid not null,
  dry_commit_certification_id uuid not null references nonprofit.production_dry_commit_certifications(id),
  dry_commit_evidence_hash text not null,
  subject_ref text not null,
  required_gate_evidence jsonb not null,
  ci_evidence jsonb not null,
  configuration_evidence jsonb not null,
  blocker_reasons jsonb not null default '[]'::jsonb,
  decision text not null,
  release_evidence_hash text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  production_send_available boolean not null default false,
  production_execution_enabled boolean not null default false,
  check (decision in ('GO','NO_GO')),
  check (production_send_available = false),
  check (production_execution_enabled = false)
);

create table if not exists nonprofit.production_release_certificates (
  id uuid primary key default gen_random_uuid(),
  release_run_id uuid not null unique references nonprofit.production_release_certification_runs(id),
  organization_id uuid not null,
  promotion_id uuid not null,
  release_evidence_hash text not null unique,
  subject_ref text not null,
  certified_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  status text not null default 'CERTIFIED',
  production_send_available boolean not null default false,
  production_execution_enabled boolean not null default false,
  check (status = 'CERTIFIED'),
  check (production_send_available = false),
  check (production_execution_enabled = false)
);

alter table nonprofit.production_release_attestations enable row level security;
alter table nonprofit.production_release_certification_runs enable row level security;
alter table nonprofit.production_release_certificates enable row level security;

create policy production_release_attestations_member_read
on nonprofit.production_release_attestations for select to authenticated
using (exists (
  select 1 from nonprofit_security.memberships m
  where m.organization_id = production_release_attestations.organization_id
    and m.user_id = auth.uid() and m.active
));

create policy production_release_runs_member_read
on nonprofit.production_release_certification_runs for select to authenticated
using (exists (
  select 1 from nonprofit_security.memberships m
  where m.organization_id = production_release_certification_runs.organization_id
    and m.user_id = auth.uid() and m.active
));

create policy production_release_certificates_member_read
on nonprofit.production_release_certificates for select to authenticated
using (exists (
  select 1 from nonprofit_security.memberships m
  where m.organization_id = production_release_certificates.organization_id
    and m.user_id = auth.uid() and m.active
));

revoke insert, update, delete on nonprofit.production_release_attestations from authenticated;
revoke insert, update, delete on nonprofit.production_release_certification_runs from authenticated;
revoke insert, update, delete on nonprofit.production_release_certificates from authenticated;
grant select on nonprofit.production_release_attestations to authenticated;
grant select on nonprofit.production_release_certification_runs to authenticated;
grant select on nonprofit.production_release_certificates to authenticated;

create or replace function nonprofit_api.record_production_release_attestation(
  p_organization_id uuid,
  p_subject_ref text,
  p_attestation_type text,
  p_attestation_ref text,
  p_status text,
  p_details jsonb,
  p_attested_by text,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_details_text text := lower(coalesce(p_details,'{}'::jsonb)::text);
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_attestation_type not in ('CI','CONFIG') then
    raise exception 'INVALID_ATTESTATION_TYPE' using errcode = '22023';
  end if;
  if p_status not in ('GREEN','RED') then
    raise exception 'INVALID_ATTESTATION_STATUS' using errcode = '22023';
  end if;
  if v_details_text ~ '(password|private_key|api_key|access_token|refresh_token|client_secret|bearer[ ]|credential_value|secret_value)' then
    raise exception 'SECRET_MATERIAL_FORBIDDEN_IN_ATTESTATION' using errcode = '22023';
  end if;

  insert into nonprofit.production_release_attestations(
    id, organization_id, subject_ref, attestation_type, attestation_ref,
    status, details, attested_by, attested_at, expires_at
  ) values (
    v_id, p_organization_id, btrim(p_subject_ref), p_attestation_type,
    btrim(p_attestation_ref), p_status, coalesce(p_details,'{}'::jsonb),
    btrim(p_attested_by), now(), p_expires_at
  )
  on conflict (organization_id, subject_ref, attestation_type) do update
    set attestation_ref = excluded.attestation_ref,
        status = excluded.status,
        details = excluded.details,
        attested_by = excluded.attested_by,
        attested_at = now(),
        expires_at = excluded.expires_at
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function nonprofit_api.record_production_release_attestation(uuid,text,text,text,text,jsonb,text,timestamptz) from public, anon, authenticated;
grant execute on function nonprofit_api.record_production_release_attestation(uuid,text,text,text,text,jsonb,text,timestamptz) to service_role;

create or replace function public.nonprofit_record_production_release_attestation(
  p_organization_id uuid,
  p_subject_ref text,
  p_attestation_type text,
  p_attestation_ref text,
  p_status text,
  p_details jsonb,
  p_attested_by text,
  p_expires_at timestamptz default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select nonprofit_api.record_production_release_attestation(
    p_organization_id,p_subject_ref,p_attestation_type,p_attestation_ref,
    p_status,p_details,p_attested_by,p_expires_at
  );
$$;

revoke all on function public.nonprofit_record_production_release_attestation(uuid,text,text,text,text,jsonb,text,timestamptz) from public, anon, authenticated;
grant execute on function public.nonprofit_record_production_release_attestation(uuid,text,text,text,text,jsonb,text,timestamptz) to service_role;

create or replace function nonprofit_api.evaluate_production_release(
  p_dry_commit_certification_id uuid,
  p_subject_ref text
)
returns table (
  release_run_id uuid,
  decision text,
  blocker_reasons jsonb,
  release_evidence_hash text,
  certificate_id uuid,
  certificate_expires_at timestamptz,
  production_send_available boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_cert record;
  v_run record;
  v_shadow record;
  v_promotion record;
  v_sandbox_cert record;
  v_ci nonprofit.production_release_attestations%rowtype;
  v_config nonprofit.production_release_attestations%rowtype;
  v_blockers jsonb := '[]'::jsonb;
  v_gate jsonb;
  v_evidence jsonb;
  v_hash text;
  v_run_id uuid := gen_random_uuid();
  v_cert_id uuid;
  v_cert_expires timestamptz;
  v_decision text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;

  select c.*, r.run_status, r.evidence_hash as run_evidence_hash
  into v_cert
  from nonprofit.production_dry_commit_certifications c
  join nonprofit.production_dry_commit_runs r on r.id = c.dry_commit_run_id
  where c.id = p_dry_commit_certification_id;

  if not found then
    raise exception 'DRY_COMMIT_CERTIFICATION_NOT_FOUND' using errcode='P0002';
  end if;

  if not exists (
    select 1 from nonprofit_security.memberships m
    where m.organization_id = v_cert.organization_id and m.user_id = v_user
      and m.active and m.can_approve
  ) then raise exception 'RELEASE_OPERATOR_NOT_AUTHORIZED' using errcode='42501'; end if;

  select s.* into v_shadow
  from public.nonprofit_production_connector_shadow_runs_v1 s
  where s.shadow_run_id = v_cert.shadow_run_id;

  select p.* into v_promotion
  from public.nonprofit_production_connector_promotions_v1 p
  where p.promotion_id = v_cert.promotion_id;

  select sc.* into v_sandbox_cert
  from public.nonprofit_sandbox_receipt_certifications_v1 sc
  where sc.id = v_promotion.sandbox_certification_id;

  select * into v_ci from nonprofit.production_release_attestations
  where organization_id=v_cert.organization_id and subject_ref=p_subject_ref and attestation_type='CI';
  select * into v_config from nonprofit.production_release_attestations
  where organization_id=v_cert.organization_id and subject_ref=p_subject_ref and attestation_type='CONFIG';

  if v_cert.expires_at <= now() then v_blockers := v_blockers || '"BLOCKED_DRY_COMMIT_EXPIRED"'::jsonb; end if;
  if v_cert.status <> 'CERTIFIED' or v_cert.run_status <> 'DRY_COMMIT_CERTIFIED' then v_blockers := v_blockers || '"BLOCKED_DRY_COMMIT_INVALID"'::jsonb; end if;
  if v_cert.evidence_hash <> v_cert.run_evidence_hash then v_blockers := v_blockers || '"BLOCKED_HASH_CHAIN_MISMATCH"'::jsonb; end if;
  if v_shadow.shadow_run_id is null or not v_shadow.shadow_certified then v_blockers := v_blockers || '"BLOCKED_SHADOW_INVALID"'::jsonb; end if;
  if v_promotion.promotion_id is null or v_promotion.promotion_status <> 'APPROVED_FOR_IMPLEMENTATION' then v_blockers := v_blockers || '"BLOCKED_PROMOTION_NOT_APPROVED"'::jsonb; end if;
  if v_promotion.protected_environment_approval_ref is null then v_blockers := v_blockers || '"BLOCKED_PROTECTED_ENVIRONMENT_APPROVAL_MISSING"'::jsonb; end if;
  if v_sandbox_cert.id is null or not v_sandbox_cert.certification_valid then v_blockers := v_blockers || '"BLOCKED_SANDBOX_CERTIFICATION_EXPIRED"'::jsonb; end if;

  if v_ci.id is null then
    v_blockers := v_blockers || '"BLOCKED_CI_ATTESTATION_MISSING"'::jsonb;
  else
    if v_ci.status <> 'GREEN' or (v_ci.expires_at is not null and v_ci.expires_at <= now()) then v_blockers := v_blockers || '"BLOCKED_CI_NOT_GREEN"'::jsonb; end if;
    if not (
      coalesce((v_ci.details->>'test_coverage')::boolean,false) and
      coalesce((v_ci.details->>'accessibility_ci')::boolean,false) and
      coalesce((v_ci.details->>'edge_functions_typecheck')::boolean,false) and
      coalesce((v_ci.details->>'pr_automation')::boolean,false) and
      coalesce((v_ci.details->>'vps_deployment_validation')::boolean,false)
    ) then v_blockers := v_blockers || '"BLOCKED_CI_CHECKS_INCOMPLETE"'::jsonb; end if;
  end if;

  if v_config.id is null then
    v_blockers := v_blockers || '"BLOCKED_CONFIG_ATTESTATION_MISSING"'::jsonb;
  else
    if v_config.status <> 'GREEN' or (v_config.expires_at is not null and v_config.expires_at <= now()) then v_blockers := v_blockers || '"BLOCKED_CONFIG_NOT_GREEN"'::jsonb; end if;
    if not (
      coalesce((v_config.details->>'production_endpoint_configured')::boolean,false) and
      coalesce((v_config.details->>'production_allowed_hosts_configured')::boolean,false) and
      coalesce((v_config.details->>'production_credentials_present')::boolean,false) and
      coalesce((v_config.details->>'tls_required')::boolean,false) and
      coalesce((v_config.details->>'idempotency_required')::boolean,false) and
      coalesce((v_config.details->>'payload_hash_required')::boolean,false) and
      coalesce((v_config.details->>'receipt_hash_required')::boolean,false)
    ) then v_blockers := v_blockers || '"BLOCKED_CONFIG_CHECKS_INCOMPLETE"'::jsonb; end if;
  end if;

  if coalesce(v_shadow.production_send_available,false) or coalesce(v_shadow.production_execution_enabled,false)
     or coalesce(v_promotion.production_send_available,false) or coalesce(v_promotion.production_execution_enabled,false) then
    v_blockers := v_blockers || '"BLOCKED_PRODUCTION_SEND_MUST_REMAIN_DISABLED"'::jsonb;
  end if;

  v_decision := case when jsonb_array_length(v_blockers)=0 then 'GO' else 'NO_GO' end;
  v_gate := jsonb_build_object(
    'gate31_certification_id',v_cert.id,
    'dry_commit_evidence_hash',v_cert.evidence_hash,
    'shadow_run_id',v_cert.shadow_run_id,
    'shadow_certified',coalesce(v_shadow.shadow_certified,false),
    'promotion_id',v_cert.promotion_id,
    'promotion_status',v_promotion.promotion_status,
    'sandbox_certification_valid',coalesce(v_sandbox_cert.certification_valid,false)
  );
  v_evidence := jsonb_build_object(
    'schema_version','grantassist.production-release-certification.v1',
    'subject_ref',p_subject_ref,
    'gate_evidence',v_gate,
    'ci_attestation',case when v_ci.id is null then '{}'::jsonb else jsonb_build_object('ref',v_ci.attestation_ref,'status',v_ci.status,'details',v_ci.details,'attested_at',v_ci.attested_at) end,
    'config_attestation',case when v_config.id is null then '{}'::jsonb else jsonb_build_object('ref',v_config.attestation_ref,'status',v_config.status,'details',v_config.details,'attested_at',v_config.attested_at) end,
    'blockers',v_blockers,
    'decision',v_decision,
    'production_send_available',false,
    'production_execution_enabled',false
  );
  v_hash := encode(extensions.digest(convert_to(v_evidence::text,'UTF8'),'sha256'),'hex');

  insert into nonprofit.production_release_certification_runs(
    id,organization_id,promotion_id,shadow_run_id,dry_commit_certification_id,
    dry_commit_evidence_hash,subject_ref,required_gate_evidence,ci_evidence,
    configuration_evidence,blocker_reasons,decision,release_evidence_hash,
    created_by,production_send_available,production_execution_enabled
  ) values (
    v_run_id,v_cert.organization_id,v_cert.promotion_id,v_cert.shadow_run_id,v_cert.id,
    v_cert.evidence_hash,p_subject_ref,v_gate,
    coalesce(v_ci.details,'{}'::jsonb),coalesce(v_config.details,'{}'::jsonb),
    v_blockers,v_decision,v_hash,v_user,false,false
  );

  if v_decision='GO' then
    v_cert_id := gen_random_uuid();
    v_cert_expires := now() + interval '1 hour';
    insert into nonprofit.production_release_certificates(
      id,release_run_id,organization_id,promotion_id,release_evidence_hash,
      subject_ref,certified_at,expires_at,status,production_send_available,production_execution_enabled
    ) values (
      v_cert_id,v_run_id,v_cert.organization_id,v_cert.promotion_id,v_hash,
      p_subject_ref,now(),v_cert_expires,'CERTIFIED',false,false
    );
  end if;

  return query select v_run_id,v_decision,v_blockers,v_hash,v_cert_id,v_cert_expires,false;
end;
$$;

revoke all on function nonprofit_api.evaluate_production_release(uuid,text) from public, anon;
grant execute on function nonprofit_api.evaluate_production_release(uuid,text) to authenticated;

create or replace function public.nonprofit_evaluate_production_release(
  p_dry_commit_certification_id uuid,
  p_subject_ref text
)
returns table (
  release_run_id uuid,
  decision text,
  blocker_reasons jsonb,
  release_evidence_hash text,
  certificate_id uuid,
  certificate_expires_at timestamptz,
  production_send_available boolean
)
language sql
security invoker
set search_path = ''
as $$ select * from nonprofit_api.evaluate_production_release(p_dry_commit_certification_id,p_subject_ref); $$;

revoke all on function public.nonprofit_evaluate_production_release(uuid,text) from public, anon;
grant execute on function public.nonprofit_evaluate_production_release(uuid,text) to authenticated;

create or replace view public.nonprofit_production_release_attestations_v1 with (security_invoker=true) as
select id,organization_id,subject_ref,attestation_type,attestation_ref,status,details,attested_by,attested_at,expires_at,
       (status='GREEN' and (expires_at is null or expires_at>now())) as attestation_valid
from nonprofit.production_release_attestations;

create or replace view public.nonprofit_production_release_runs_v1 with (security_invoker=true) as
select r.*, false as production_send_available_effective
from nonprofit.production_release_certification_runs r;

create or replace view public.nonprofit_production_release_certificates_v1 with (security_invoker=true) as
select c.*, (c.status='CERTIFIED' and c.expires_at>now()) as certificate_valid,
       false as production_send_available_effective
from nonprofit.production_release_certificates c;

grant select on public.nonprofit_production_release_attestations_v1 to authenticated;
grant select on public.nonprofit_production_release_runs_v1 to authenticated;
grant select on public.nonprofit_production_release_certificates_v1 to authenticated;
revoke all on public.nonprofit_production_release_attestations_v1 from anon;
revoke all on public.nonprofit_production_release_runs_v1 from anon;
revoke all on public.nonprofit_production_release_certificates_v1 from anon;
