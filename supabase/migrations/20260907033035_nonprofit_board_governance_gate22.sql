create table if not exists nonprofit_security.board_governance_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references nonprofit.organizations(id) on delete cascade,
  quorum_mode text not null default 'MAJORITY_ACTIVE_BOARD' check (quorum_mode in ('MAJORITY_ACTIVE_BOARD')),
  vote_mode text not null default 'MAJORITY_VOTES_CAST' check (vote_mode in ('MAJORITY_VOTES_CAST')),
  written_consent_mode text not null default 'UNANIMOUS_ELIGIBLE_BOARD' check (written_consent_mode in ('UNANIMOUS_ELIGIBLE_BOARD')),
  recused_counts_for_quorum boolean not null default true,
  effective boolean not null default false,
  status text not null default 'DRAFT' check (status in ('DRAFT','ADOPTED','SUPERSEDED')),
  authority_basis text,
  evidence_hash text,
  adopted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((effective = false) or (status = 'ADOPTED' and authority_basis is not null and evidence_hash is not null and adopted_at is not null))
);

create table if not exists nonprofit_security.board_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references nonprofit.organizations(id) on delete cascade,
  session_type text not null default 'MEETING' check (session_type in ('MEETING','WRITTEN_CONSENT')),
  title text not null,
  scheduled_at timestamptz,
  opened_at timestamptz,
  closed_at timestamptz,
  status text not null default 'DRAFT' check (status in ('DRAFT','NOTICE','OPEN','CLOSED','ADOPTED','CANCELLED')),
  notice_evidence_hash text,
  minutes_evidence_hash text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists nonprofit_security.board_agenda_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references nonprofit_security.board_sessions(id) on delete cascade,
  item_no smallint not null check (item_no > 0),
  title text not null,
  action_type text not null,
  resource_type text,
  resource_id uuid,
  related_party boolean not null default false,
  proposed_resolution text,
  status text not null default 'DRAFT' check (status in ('DRAFT','OPEN','VOTING','ADOPTED','REJECTED','WITHDRAWN')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(session_id,item_no)
);

create table if not exists nonprofit_security.board_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references nonprofit_security.board_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  attendance_status text not null default 'PRESENT' check (attendance_status in ('PRESENT','REMOTE','ABSENT')),
  recorded_at timestamptz not null default now(),
  unique(session_id,user_id)
);

create table if not exists nonprofit_security.board_votes (
  id uuid primary key default gen_random_uuid(),
  agenda_item_id uuid not null references nonprofit_security.board_agenda_items(id) on delete cascade,
  voter_user_id uuid not null references auth.users(id),
  vote text not null check (vote in ('YES','NO','ABSTAIN')),
  cast_at timestamptz not null default now(),
  unique(agenda_item_id,voter_user_id)
);

create table if not exists nonprofit_security.board_resolutions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references nonprofit.organizations(id) on delete cascade,
  agenda_item_id uuid not null unique references nonprofit_security.board_agenda_items(id) on delete restrict,
  resolution_number text not null,
  resolution_text text not null,
  authority_basis text not null,
  adopted_by uuid not null references auth.users(id),
  adopted_at timestamptz not null default now(),
  approval_id uuid references nonprofit_security.approvals(id),
  evidence_hash text not null,
  created_at timestamptz not null default now(),
  unique(organization_id,resolution_number)
);

create index if not exists board_sessions_org_status_idx on nonprofit_security.board_sessions(organization_id,status,scheduled_at);
create index if not exists board_sessions_created_by_idx on nonprofit_security.board_sessions(created_by);
create index if not exists board_agenda_session_status_idx on nonprofit_security.board_agenda_items(session_id,status);
create index if not exists board_agenda_created_by_idx on nonprofit_security.board_agenda_items(created_by);
create index if not exists board_attendance_user_idx on nonprofit_security.board_attendance(user_id);
create index if not exists board_votes_voter_idx on nonprofit_security.board_votes(voter_user_id);
create index if not exists board_resolutions_org_adopted_idx on nonprofit_security.board_resolutions(organization_id,adopted_at desc);
create index if not exists board_resolutions_adopted_by_idx on nonprofit_security.board_resolutions(adopted_by);
create index if not exists board_resolutions_approval_idx on nonprofit_security.board_resolutions(approval_id);

alter table nonprofit_security.board_governance_rules enable row level security;
alter table nonprofit_security.board_sessions enable row level security;
alter table nonprofit_security.board_agenda_items enable row level security;
alter table nonprofit_security.board_attendance enable row level security;
alter table nonprofit_security.board_votes enable row level security;
alter table nonprofit_security.board_resolutions enable row level security;

revoke all on nonprofit_security.board_governance_rules, nonprofit_security.board_sessions, nonprofit_security.board_agenda_items, nonprofit_security.board_attendance, nonprofit_security.board_votes, nonprofit_security.board_resolutions from public, anon, authenticated;
grant select on nonprofit_security.board_governance_rules to authenticated;
grant select,insert,update on nonprofit_security.board_sessions, nonprofit_security.board_agenda_items, nonprofit_security.board_attendance, nonprofit_security.board_votes to authenticated;
grant select on nonprofit_security.board_resolutions to authenticated;
grant all on nonprofit_security.board_governance_rules, nonprofit_security.board_sessions, nonprofit_security.board_agenda_items, nonprofit_security.board_attendance, nonprofit_security.board_votes, nonprofit_security.board_resolutions to service_role;

create policy board_rules_governance_read on nonprofit_security.board_governance_rules for select to authenticated using ((select nonprofit_security.is_member(organization_id,array['BOARD','EXECUTIVE','COMPLIANCE','AUDITOR']::nonprofit_security.member_role[])));
create policy board_sessions_governance_read on nonprofit_security.board_sessions for select to authenticated using ((select nonprofit_security.is_member(organization_id,array['BOARD','EXECUTIVE','COMPLIANCE','AUDITOR']::nonprofit_security.member_role[])));
create policy board_sessions_governance_insert on nonprofit_security.board_sessions for insert to authenticated with check (created_by=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2' and (select nonprofit_security.is_member(organization_id,array['BOARD','EXECUTIVE']::nonprofit_security.member_role[])));
create policy board_sessions_governance_update on nonprofit_security.board_sessions for update to authenticated using ((select auth.jwt()->>'aal')='aal2' and (select nonprofit_security.is_member(organization_id,array['BOARD','EXECUTIVE']::nonprofit_security.member_role[]))) with check ((select auth.jwt()->>'aal')='aal2' and (select nonprofit_security.is_member(organization_id,array['BOARD','EXECUTIVE']::nonprofit_security.member_role[])));
create policy board_agenda_governance_read on nonprofit_security.board_agenda_items for select to authenticated using (exists(select 1 from nonprofit_security.board_sessions s where s.id=board_agenda_items.session_id and (select nonprofit_security.is_member(s.organization_id,array['BOARD','EXECUTIVE','COMPLIANCE','AUDITOR']::nonprofit_security.member_role[]))));
create policy board_agenda_governance_insert on nonprofit_security.board_agenda_items for insert to authenticated with check (created_by=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2' and exists(select 1 from nonprofit_security.board_sessions s where s.id=board_agenda_items.session_id and (select nonprofit_security.is_member(s.organization_id,array['BOARD','EXECUTIVE']::nonprofit_security.member_role[]))));
create policy board_agenda_governance_update on nonprofit_security.board_agenda_items for update to authenticated using ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from nonprofit_security.board_sessions s where s.id=board_agenda_items.session_id and (select nonprofit_security.is_member(s.organization_id,array['BOARD','EXECUTIVE']::nonprofit_security.member_role[])))) with check ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from nonprofit_security.board_sessions s where s.id=board_agenda_items.session_id and (select nonprofit_security.is_member(s.organization_id,array['BOARD','EXECUTIVE']::nonprofit_security.member_role[]))));
create policy board_attendance_governance_read on nonprofit_security.board_attendance for select to authenticated using (exists(select 1 from nonprofit_security.board_sessions s where s.id=board_attendance.session_id and (select nonprofit_security.is_member(s.organization_id,array['BOARD','EXECUTIVE','COMPLIANCE','AUDITOR']::nonprofit_security.member_role[]))));
create policy board_attendance_self_insert on nonprofit_security.board_attendance for insert to authenticated with check (user_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2' and exists(select 1 from nonprofit_security.board_sessions s where s.id=board_attendance.session_id and (select nonprofit_security.is_member(s.organization_id,array['BOARD']::nonprofit_security.member_role[]))));
create policy board_attendance_self_update on nonprofit_security.board_attendance for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy board_votes_governance_read on nonprofit_security.board_votes for select to authenticated using (exists(select 1 from nonprofit_security.board_agenda_items i join nonprofit_security.board_sessions s on s.id=i.session_id where i.id=board_votes.agenda_item_id and (select nonprofit_security.is_member(s.organization_id,array['BOARD','EXECUTIVE','COMPLIANCE','AUDITOR']::nonprofit_security.member_role[]))));
create policy board_votes_self_insert on nonprofit_security.board_votes for insert to authenticated with check (voter_user_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2' and exists(select 1 from nonprofit_security.board_agenda_items i join nonprofit_security.board_sessions s on s.id=i.session_id where i.id=board_votes.agenda_item_id and i.status='VOTING' and s.status='OPEN' and (select nonprofit_security.is_member(s.organization_id,array['BOARD']::nonprofit_security.member_role[])) and not (select nonprofit_security.is_recused(s.organization_id,'BOARD_ITEM',i.id))));
create policy board_votes_self_update on nonprofit_security.board_votes for update to authenticated using (voter_user_id=(select auth.uid())) with check (voter_user_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2' and exists(select 1 from nonprofit_security.board_agenda_items i join nonprofit_security.board_sessions s on s.id=i.session_id where i.id=board_votes.agenda_item_id and i.status='VOTING' and s.status='OPEN' and not (select nonprofit_security.is_recused(s.organization_id,'BOARD_ITEM',i.id))));
create policy board_resolutions_governance_read on nonprofit_security.board_resolutions for select to authenticated using ((select nonprofit_security.is_member(organization_id,array['BOARD','EXECUTIVE','COMPLIANCE','AUDITOR']::nonprofit_security.member_role[])));

insert into nonprofit_security.board_governance_rules(organization_id,status,effective)
select id,'DRAFT',false from nonprofit.organizations where legal_name='D3VONN.IO Institute, Inc.'
on conflict (organization_id) do nothing;

create or replace function public.nonprofit_cast_board_vote(p_agenda_item_id uuid,p_vote text) returns uuid language plpgsql security invoker set search_path=pg_catalog,public,nonprofit,nonprofit_security as $$ declare v_id uuid; begin if p_vote not in ('YES','NO','ABSTAIN') then raise exception 'INVALID_VOTE'; end if; insert into nonprofit_security.board_votes(agenda_item_id,voter_user_id,vote) values(p_agenda_item_id,(select auth.uid()),p_vote) on conflict(agenda_item_id,voter_user_id) do update set vote=excluded.vote,cast_at=now() returning id into v_id; return v_id; end; $$;
create or replace function public.nonprofit_mark_board_attendance(p_session_id uuid,p_status text default 'PRESENT') returns uuid language plpgsql security invoker set search_path=pg_catalog,public,nonprofit,nonprofit_security as $$ declare v_id uuid; begin if p_status not in ('PRESENT','REMOTE','ABSENT') then raise exception 'INVALID_ATTENDANCE_STATUS'; end if; insert into nonprofit_security.board_attendance(session_id,user_id,attendance_status) values(p_session_id,(select auth.uid()),p_status) on conflict(session_id,user_id) do update set attendance_status=excluded.attendance_status,recorded_at=now() returning id into v_id; return v_id; end; $$;

create or replace function nonprofit_security.finalize_board_item_internal(p_agenda_item_id uuid) returns uuid language plpgsql security definer set search_path=pg_catalog,public,nonprofit,nonprofit_security,extensions as $$
declare
 v_uid uuid := (select auth.uid()); v_aal text := (select auth.jwt()->>'aal'); v_org uuid; v_session uuid; v_session_type text; v_session_status text; v_item_status text; v_resolution_text text; v_action_type text; v_rules record; v_board_count int; v_recused_count int; v_quorum_denominator int; v_quorum_required int; v_present int; v_yes int; v_no int; v_abstain int; v_eligible int; v_resolution_id uuid; v_approval_id uuid; v_resolution_number text; v_prev_hash text; v_event_hash text; v_evidence_hash text;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if; if v_aal <> 'aal2' then raise exception 'MFA_AAL2_REQUIRED'; end if;
 select s.organization_id,s.id,s.session_type,s.status,i.status,i.proposed_resolution,i.action_type into v_org,v_session,v_session_type,v_session_status,v_item_status,v_resolution_text,v_action_type from nonprofit_security.board_agenda_items i join nonprofit_security.board_sessions s on s.id=i.session_id where i.id=p_agenda_item_id;
 if v_org is null then raise exception 'BOARD_ITEM_NOT_FOUND'; end if;
 if not exists(select 1 from nonprofit_security.memberships m where m.organization_id=v_org and m.user_id=v_uid and m.role='BOARD' and m.active and m.can_approve) then raise exception 'BOARD_APPROVER_REQUIRED'; end if;
 if nonprofit_security.is_recused(v_org,'BOARD_ITEM',p_agenda_item_id) then raise exception 'RECUSAL_BLOCKS_APPROVAL'; end if;
 if v_session_status <> 'OPEN' or v_item_status <> 'VOTING' then raise exception 'BOARD_ITEM_NOT_OPEN_FOR_FINALIZATION'; end if;
 select * into v_rules from nonprofit_security.board_governance_rules where organization_id=v_org;
 if v_rules.id is null or not v_rules.effective or v_rules.status <> 'ADOPTED' then raise exception 'GOVERNANCE_RULES_NOT_ADOPTED'; end if;
 select count(*) into v_board_count from nonprofit_security.memberships m where m.organization_id=v_org and m.role='BOARD' and m.active;
 if v_board_count < 1 then raise exception 'NO_ACTIVE_BOARD'; end if;
 select count(*) into v_recused_count from nonprofit_security.memberships m where m.organization_id=v_org and m.role='BOARD' and m.active and exists(select 1 from nonprofit_security.recusal_events r where r.organization_id=v_org and r.user_id=m.user_id and r.resource_type='BOARD_ITEM' and r.resource_id=p_agenda_item_id and r.active);
 v_eligible:=greatest(v_board_count-v_recused_count,0); v_quorum_denominator:=case when v_rules.recused_counts_for_quorum then v_board_count else v_eligible end; v_quorum_required:=floor(v_quorum_denominator/2.0)::int+1;
 select count(*) into v_present from nonprofit_security.board_attendance a join nonprofit_security.memberships m on m.user_id=a.user_id and m.organization_id=v_org and m.role='BOARD' and m.active where a.session_id=v_session and a.attendance_status in ('PRESENT','REMOTE') and (v_rules.recused_counts_for_quorum or not exists(select 1 from nonprofit_security.recusal_events r where r.organization_id=v_org and r.user_id=a.user_id and r.resource_type='BOARD_ITEM' and r.resource_id=p_agenda_item_id and r.active));
 select count(*) filter(where v.vote='YES'),count(*) filter(where v.vote='NO'),count(*) filter(where v.vote='ABSTAIN') into v_yes,v_no,v_abstain from nonprofit_security.board_votes v join nonprofit_security.memberships m on m.user_id=v.voter_user_id and m.organization_id=v_org and m.role='BOARD' and m.active where v.agenda_item_id=p_agenda_item_id and not exists(select 1 from nonprofit_security.recusal_events r where r.organization_id=v_org and r.user_id=v.voter_user_id and r.resource_type='BOARD_ITEM' and r.resource_id=p_agenda_item_id and r.active);
 if v_session_type='WRITTEN_CONSENT' then if v_eligible<1 or v_yes<>v_eligible or v_no<>0 or v_abstain<>0 then raise exception 'WRITTEN_CONSENT_NOT_UNANIMOUS'; end if; else if v_present<v_quorum_required then raise exception 'QUORUM_NOT_MET'; end if; if v_yes<=v_no then raise exception 'MOTION_NOT_APPROVED'; end if; end if;
 if nullif(btrim(v_resolution_text),'') is null then raise exception 'RESOLUTION_TEXT_REQUIRED'; end if;
 v_resolution_number:='BR-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(p_agenda_item_id::text,'-',''),1,8)); v_evidence_hash:=encode(extensions.digest((v_org::text||'|'||p_agenda_item_id::text||'|'||v_resolution_text||'|'||now()::date::text)::bytea,'sha256'),'hex');
 insert into nonprofit_security.approvals(organization_id,action_type,resource_type,resource_id,requested_by_user,approved_by,authority_basis,approved_at,status,conditions_json) values(v_org,v_action_type,'BOARD_RESOLUTION',p_agenda_item_id,v_uid,v_uid,'Board action recorded by Gate 22',now(),'APPROVED',jsonb_build_object('gate','22','board_item_id',p_agenda_item_id,'quorum_required',v_quorum_required,'present',v_present,'yes',v_yes,'no',v_no,'abstain',v_abstain)) returning id into v_approval_id;
 insert into nonprofit_security.board_resolutions(organization_id,agenda_item_id,resolution_number,resolution_text,authority_basis,adopted_by,approval_id,evidence_hash) values(v_org,p_agenda_item_id,v_resolution_number,v_resolution_text,'Adopted under effective nonprofit board governance rules',v_uid,v_approval_id,v_evidence_hash) returning id into v_resolution_id;
 update nonprofit_security.board_agenda_items set status='ADOPTED' where id=p_agenda_item_id;
 select event_hash into v_prev_hash from nonprofit_security.audit_events where organization_id=v_org order by event_at desc,id desc limit 1; v_event_hash:=encode(extensions.digest((coalesce(v_prev_hash,'')||'|'||v_org::text||'|'||v_resolution_id::text||'|'||v_uid::text||'|BOARD_RESOLUTION_ADOPTED|'||v_evidence_hash)::bytea,'sha256'),'hex');
 insert into nonprofit_security.audit_events(organization_id,actor_type,actor_id,event_type,resource_type,resource_id,action,approval_id,result,previous_event_hash,event_hash,output_hash) values(v_org,'HUMAN',v_uid,'BOARD_RESOLUTION_ADOPTED','BOARD_RESOLUTION',v_resolution_id,'FINALIZE_BOARD_ITEM',v_approval_id,'ADOPTED',v_prev_hash,v_event_hash,v_evidence_hash);
 return v_resolution_id;
end; $$;

revoke all on function nonprofit_security.finalize_board_item_internal(uuid) from public,anon;
grant execute on function nonprofit_security.finalize_board_item_internal(uuid) to authenticated,service_role;
create or replace function public.nonprofit_finalize_board_item(p_agenda_item_id uuid) returns uuid language sql security invoker set search_path=pg_catalog,public,nonprofit,nonprofit_security as $$ select nonprofit_security.finalize_board_item_internal(p_agenda_item_id); $$;
revoke all on function public.nonprofit_cast_board_vote(uuid,text), public.nonprofit_mark_board_attendance(uuid,text), public.nonprofit_finalize_board_item(uuid) from public,anon;
grant execute on function public.nonprofit_cast_board_vote(uuid,text), public.nonprofit_mark_board_attendance(uuid,text), public.nonprofit_finalize_board_item(uuid) to authenticated;

create or replace view public.nonprofit_board_status_v1 with (security_invoker=true) as
select s.id session_id,s.organization_id,s.session_type,s.title,s.status session_status,s.scheduled_at,i.id agenda_item_id,i.item_no,i.title agenda_title,i.action_type,i.related_party,i.status agenda_status,count(distinct a.user_id) filter(where a.attendance_status in ('PRESENT','REMOTE')) present_directors,count(distinct v.voter_user_id) filter(where v.vote='YES') yes_votes,count(distinct v.voter_user_id) filter(where v.vote='NO') no_votes,count(distinct v.voter_user_id) filter(where v.vote='ABSTAIN') abstain_votes,r.id resolution_id,r.resolution_number,r.adopted_at from nonprofit_security.board_sessions s left join nonprofit_security.board_agenda_items i on i.session_id=s.id left join nonprofit_security.board_attendance a on a.session_id=s.id left join nonprofit_security.board_votes v on v.agenda_item_id=i.id left join nonprofit_security.board_resolutions r on r.agenda_item_id=i.id group by s.id,s.organization_id,s.session_type,s.title,s.status,s.scheduled_at,i.id,i.item_no,i.title,i.action_type,i.related_party,i.status,r.id,r.resolution_number,r.adopted_at;
grant select on public.nonprofit_board_status_v1 to authenticated;
revoke all on public.nonprofit_board_status_v1 from anon;
