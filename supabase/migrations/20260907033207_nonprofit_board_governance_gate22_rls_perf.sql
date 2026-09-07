drop policy if exists board_sessions_governance_insert on nonprofit_security.board_sessions;
create policy board_sessions_governance_insert on nonprofit_security.board_sessions for insert to authenticated with check (created_by=(select auth.uid()) and ((select auth.jwt())->>'aal')='aal2' and (select nonprofit_security.is_member(organization_id,array['BOARD','EXECUTIVE']::nonprofit_security.member_role[])));

drop policy if exists board_sessions_governance_update on nonprofit_security.board_sessions;
create policy board_sessions_governance_update on nonprofit_security.board_sessions for update to authenticated using (((select auth.jwt())->>'aal')='aal2' and (select nonprofit_security.is_member(organization_id,array['BOARD','EXECUTIVE']::nonprofit_security.member_role[]))) with check (((select auth.jwt())->>'aal')='aal2' and (select nonprofit_security.is_member(organization_id,array['BOARD','EXECUTIVE']::nonprofit_security.member_role[])));

drop policy if exists board_agenda_governance_insert on nonprofit_security.board_agenda_items;
create policy board_agenda_governance_insert on nonprofit_security.board_agenda_items for insert to authenticated with check (created_by=(select auth.uid()) and ((select auth.jwt())->>'aal')='aal2' and exists (select 1 from nonprofit_security.board_sessions s where s.id=board_agenda_items.session_id and (select nonprofit_security.is_member(s.organization_id,array['BOARD','EXECUTIVE']::nonprofit_security.member_role[]))));

drop policy if exists board_agenda_governance_update on nonprofit_security.board_agenda_items;
create policy board_agenda_governance_update on nonprofit_security.board_agenda_items for update to authenticated using (((select auth.jwt())->>'aal')='aal2' and exists (select 1 from nonprofit_security.board_sessions s where s.id=board_agenda_items.session_id and (select nonprofit_security.is_member(s.organization_id,array['BOARD','EXECUTIVE']::nonprofit_security.member_role[])))) with check (((select auth.jwt())->>'aal')='aal2' and exists (select 1 from nonprofit_security.board_sessions s where s.id=board_agenda_items.session_id and (select nonprofit_security.is_member(s.organization_id,array['BOARD','EXECUTIVE']::nonprofit_security.member_role[]))));

drop policy if exists board_attendance_self_insert on nonprofit_security.board_attendance;
create policy board_attendance_self_insert on nonprofit_security.board_attendance for insert to authenticated with check (user_id=(select auth.uid()) and ((select auth.jwt())->>'aal')='aal2' and exists (select 1 from nonprofit_security.board_sessions s where s.id=board_attendance.session_id and (select nonprofit_security.is_member(s.organization_id,array['BOARD']::nonprofit_security.member_role[]))));

drop policy if exists board_attendance_self_update on nonprofit_security.board_attendance;
create policy board_attendance_self_update on nonprofit_security.board_attendance for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()) and ((select auth.jwt())->>'aal')='aal2');

drop policy if exists board_votes_self_insert on nonprofit_security.board_votes;
create policy board_votes_self_insert on nonprofit_security.board_votes for insert to authenticated with check (voter_user_id=(select auth.uid()) and ((select auth.jwt())->>'aal')='aal2' and exists (select 1 from nonprofit_security.board_agenda_items i join nonprofit_security.board_sessions s on s.id=i.session_id where i.id=board_votes.agenda_item_id and i.status='VOTING' and s.status='OPEN' and (select nonprofit_security.is_member(s.organization_id,array['BOARD']::nonprofit_security.member_role[])) and not (select nonprofit_security.is_recused(s.organization_id,'BOARD_ITEM',i.id))));

drop policy if exists board_votes_self_update on nonprofit_security.board_votes;
create policy board_votes_self_update on nonprofit_security.board_votes for update to authenticated using (voter_user_id=(select auth.uid())) with check (voter_user_id=(select auth.uid()) and ((select auth.jwt())->>'aal')='aal2' and exists (select 1 from nonprofit_security.board_agenda_items i join nonprofit_security.board_sessions s on s.id=i.session_id where i.id=board_votes.agenda_item_id and i.status='VOTING' and s.status='OPEN' and not (select nonprofit_security.is_recused(s.organization_id,'BOARD_ITEM',i.id))));
