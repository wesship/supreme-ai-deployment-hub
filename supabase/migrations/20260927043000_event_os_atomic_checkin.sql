-- Event OS atomic staff check-in
begin;

create or replace function private.commit_event_ticket_checkin(
  p_ticket_id uuid,
  p_scanned_by uuid,
  p_device_id text default null
) returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_catalog
as $$
declare
  v_ticket public.tickets%rowtype;
  v_checkin_id uuid;
begin
  select * into v_ticket
  from public.tickets
  where id=p_ticket_id
  for update;

  if not found then
    raise exception 'ticket_not_found';
  end if;

  if v_ticket.status='checked_in' then
    return jsonb_build_object(
      'ticket_id',v_ticket.id,
      'event_id',v_ticket.event_id,
      'status','checked_in',
      'checked_in_at',v_ticket.checked_in_at,
      'duplicate',true
    );
  end if;

  if v_ticket.status<>'issued' then
    raise exception 'ticket_not_checkin_eligible:%',v_ticket.status;
  end if;

  update public.tickets
  set status='checked_in',
      checked_in_at=now()
  where id=v_ticket.id;

  insert into public.ticket_checkins(
    workspace_id,ticket_id,event_id,scanned_by,result,device_id
  ) values(
    v_ticket.workspace_id,v_ticket.id,v_ticket.event_id,p_scanned_by,'accepted',p_device_id
  )
  returning id into v_checkin_id;

  return jsonb_build_object(
    'ticket_id',v_ticket.id,
    'event_id',v_ticket.event_id,
    'checkin_id',v_checkin_id,
    'status','checked_in',
    'checked_in_at',now(),
    'duplicate',false
  );
end;
$$;

revoke all on function private.commit_event_ticket_checkin(uuid,uuid,text) from public;

create or replace function public.event_os_commit_checkin(
  p_ticket_id uuid,
  p_scanned_by uuid,
  p_device_id text default null
) returns jsonb
language sql
security definer
set search_path=public,private,pg_catalog
as $$
  select private.commit_event_ticket_checkin(p_ticket_id,p_scanned_by,p_device_id);
$$;

revoke all on function public.event_os_commit_checkin(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.event_os_commit_checkin(uuid,uuid,text) to service_role;

commit;
