create table if not exists nonprofit.production_dry_commit_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  promotion_id uuid not null references nonprofit.production_connector_promotions(id),
  shadow_run_id uuid not null references nonprofit.production_connector_shadow_runs(id),
  execution_token_id uuid not null references nonprofit.production_execution_tokens(id),
  request_body_hash text not null,
  issued_token_status text not null,
  validation_status text not null,
  consume_status text not null,
  replay_status text not null,
  expiry_status text not null,
  simulated_receipt jsonb not null,
  evidence_hash text not null,
  run_status text not null,
  network_request_performed boolean not null default false,
  application_payload_transmitted boolean not null default false,
  production_execution_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  check (run_status in ('DRY_COMMIT_CERTIFIED','DRY_COMMIT_FAILED')),
  check (network_request_performed = false),
  check (application_payload_transmitted = false),
  check (production_execution_enabled = false)
);

create table if not exists nonprofit.production_dry_commit_certifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  dry_commit_run_id uuid not null unique references nonprofit.production_dry_commit_runs(id),
  promotion_id uuid not null,
  shadow_run_id uuid not null,
  request_body_hash text not null,
  evidence_hash text not null,
  certified_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  status text not null default 'CERTIFIED',
  production_send_available boolean not null default false,
  check (status = 'CERTIFIED'),
  check (production_send_available = false)
);

alter table nonprofit.production_dry_commit_runs enable row level security;
alter table nonprofit.production_dry_commit_certifications enable row level security;

create policy production_dry_commit_runs_member_read on nonprofit.production_dry_commit_runs for select to authenticated using (exists (select 1 from nonprofit_security.memberships m where m.organization_id = production_dry_commit_runs.organization_id and m.user_id = auth.uid() and m.active));
create policy production_dry_commit_certifications_member_read on nonprofit.production_dry_commit_certifications for select to authenticated using (exists (select 1 from nonprofit_security.memberships m where m.organization_id = production_dry_commit_certifications.organization_id and m.user_id = auth.uid() and m.active));

revoke insert, update, delete on nonprofit.production_dry_commit_runs from authenticated;
revoke insert, update, delete on nonprofit.production_dry_commit_certifications from authenticated;
grant select on nonprofit.production_dry_commit_runs to authenticated;
grant select on nonprofit.production_dry_commit_certifications to authenticated;

create or replace function nonprofit_api.expire_execution_token_for_dry_commit_test(p_execution_token_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if current_user not in ('postgres','service_role','supabase_admin') then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  update nonprofit.production_execution_tokens
  set expires_at = now() - interval '1 second'
  where id = p_execution_token_id and status = 'ISSUED';
  if not found then raise exception 'LIVE_TEST_TOKEN_REQUIRED' using errcode='55000'; end if;
end; $$;
revoke all on function nonprofit_api.expire_execution_token_for_dry_commit_test(uuid) from public, anon, authenticated;
grant execute on function nonprofit_api.expire_execution_token_for_dry_commit_test(uuid) to service_role;
create or replace function public.nonprofit_expire_execution_token_for_dry_commit_test(p_execution_token_id uuid) returns void language sql security invoker set search_path='' as $$ select nonprofit_api.expire_execution_token_for_dry_commit_test(p_execution_token_id); $$;
revoke all on function public.nonprofit_expire_execution_token_for_dry_commit_test(uuid) from public, anon, authenticated;
grant execute on function public.nonprofit_expire_execution_token_for_dry_commit_test(uuid) to service_role;

create or replace function nonprofit_api.record_production_dry_commit_run(p_shadow_run_id uuid,p_execution_token_id uuid,p_validation_status text,p_consume_status text,p_replay_status text,p_expiry_status text,p_simulated_receipt jsonb)
returns table (dry_commit_run_id uuid,dry_commit_status text,evidence_hash text,certification_id uuid,certification_expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_shadow record; v_token nonprofit.production_execution_tokens%rowtype; v_run_id uuid:=gen_random_uuid(); v_cert_id uuid:=gen_random_uuid(); v_evidence jsonb; v_hash text; v_status text; v_expires timestamptz:=now()+interval '24 hours';
begin
  if current_user not in ('postgres','service_role','supabase_admin') then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select s.* into v_shadow from public.nonprofit_production_connector_shadow_runs_v1 s where s.shadow_run_id=p_shadow_run_id;
  if not found or not v_shadow.shadow_certified then raise exception 'VALID_SHADOW_REQUIRED' using errcode='42501'; end if;
  select * into v_token from nonprofit.production_execution_tokens where id=p_execution_token_id and shadow_run_id=p_shadow_run_id;
  if not found then raise exception 'EXECUTION_TOKEN_NOT_FOUND_FOR_SHADOW' using errcode='P0002'; end if;
  if v_token.request_body_hash<>v_shadow.request_body_hash then raise exception 'DRY_COMMIT_REQUEST_HASH_MISMATCH' using errcode='42501'; end if;
  v_evidence:=jsonb_build_object('schema_version','grantassist.production-dry-commit.v1','shadow_run_id',p_shadow_run_id,'promotion_id',v_shadow.promotion_id,'execution_token_id',p_execution_token_id,'request_body_hash',v_shadow.request_body_hash,'issued_token_status',v_token.status,'validation_status',p_validation_status,'consume_status',p_consume_status,'replay_status',p_replay_status,'expiry_status',p_expiry_status,'simulated_receipt',coalesce(p_simulated_receipt,'{}'::jsonb),'network_request_performed',false,'application_payload_transmitted',false,'production_execution_enabled',false);
  v_hash:=encode(extensions.digest(convert_to(v_evidence::text,'UTF8'),'sha256'),'hex');
  v_status:=case when p_validation_status='PREFLIGHT_CERTIFIED' and p_consume_status='CONSUMED' and p_replay_status='REPLAY_BLOCKED' and p_expiry_status='EXPIRY_BLOCKED' then 'DRY_COMMIT_CERTIFIED' else 'DRY_COMMIT_FAILED' end;
  insert into nonprofit.production_dry_commit_runs(id,organization_id,promotion_id,shadow_run_id,execution_token_id,request_body_hash,issued_token_status,validation_status,consume_status,replay_status,expiry_status,simulated_receipt,evidence_hash,run_status,network_request_performed,application_payload_transmitted,production_execution_enabled)
  values(v_run_id,v_shadow.organization_id,v_shadow.promotion_id,p_shadow_run_id,p_execution_token_id,v_shadow.request_body_hash,v_token.status,p_validation_status,p_consume_status,p_replay_status,p_expiry_status,coalesce(p_simulated_receipt,'{}'::jsonb),v_hash,v_status,false,false,false);
  if v_status='DRY_COMMIT_CERTIFIED' then insert into nonprofit.production_dry_commit_certifications(id,organization_id,dry_commit_run_id,promotion_id,shadow_run_id,request_body_hash,evidence_hash,certified_at,expires_at,production_send_available) values(v_cert_id,v_shadow.organization_id,v_run_id,v_shadow.promotion_id,p_shadow_run_id,v_shadow.request_body_hash,v_hash,now(),v_expires,false); else v_cert_id:=null; v_expires:=null; end if;
  return query select v_run_id,v_status,v_hash,v_cert_id,v_expires;
end; $$;
revoke all on function nonprofit_api.record_production_dry_commit_run(uuid,uuid,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function nonprofit_api.record_production_dry_commit_run(uuid,uuid,text,text,text,text,jsonb) to service_role;
create or replace function public.nonprofit_record_production_dry_commit_run(p_shadow_run_id uuid,p_execution_token_id uuid,p_validation_status text,p_consume_status text,p_replay_status text,p_expiry_status text,p_simulated_receipt jsonb)
returns table(dry_commit_run_id uuid,dry_commit_status text,evidence_hash text,certification_id uuid,certification_expires_at timestamptz) language sql security invoker set search_path='' as $$ select * from nonprofit_api.record_production_dry_commit_run(p_shadow_run_id,p_execution_token_id,p_validation_status,p_consume_status,p_replay_status,p_expiry_status,p_simulated_receipt); $$;
revoke all on function public.nonprofit_record_production_dry_commit_run(uuid,uuid,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.nonprofit_record_production_dry_commit_run(uuid,uuid,text,text,text,text,jsonb) to service_role;

create or replace view public.nonprofit_production_dry_commit_runs_v1 with (security_invoker=true) as select r.*,false as production_send_available from nonprofit.production_dry_commit_runs r;
grant select on public.nonprofit_production_dry_commit_runs_v1 to authenticated; revoke all on public.nonprofit_production_dry_commit_runs_v1 from anon;
create or replace view public.nonprofit_production_dry_commit_certifications_v1 with (security_invoker=true) as select c.*,(c.status='CERTIFIED' and c.expires_at>now()) as certification_valid,false as production_send_available_effective from nonprofit.production_dry_commit_certifications c;
grant select on public.nonprofit_production_dry_commit_certifications_v1 to authenticated; revoke all on public.nonprofit_production_dry_commit_certifications_v1 from anon;