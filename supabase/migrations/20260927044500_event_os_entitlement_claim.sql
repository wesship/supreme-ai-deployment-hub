-- Event OS post-payment account claim for guest purchases
begin;

create or replace function private.claim_event_order_entitlements(
  p_order_id uuid,
  p_user_id uuid,
  p_claim_hash text
) returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_catalog
as $$
declare
  v_order public.orders%rowtype;
  v_expected text;
  v_entitlements integer := 0;
  v_tickets integer := 0;
begin
  select * into v_order
  from public.orders
  where id=p_order_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  if v_order.status<>'paid' then
    raise exception 'order_not_paid';
  end if;

  if v_order.purchaser_user_id is not null and v_order.purchaser_user_id<>p_user_id then
    raise exception 'order_already_claimed';
  end if;

  v_expected := v_order.metadata->>'claim_token_hash';

  if v_expected is null then
    if v_order.purchaser_user_id=p_user_id then
      return jsonb_build_object(
        'order_id',p_order_id,
        'user_id',p_user_id,
        'claimed',true,
        'idempotent',true
      );
    end if;
    raise exception 'claim_token_missing';
  end if;

  if v_expected<>p_claim_hash then
    raise exception 'claim_token_invalid';
  end if;

  update public.orders
  set purchaser_user_id=p_user_id,
      metadata=(metadata - 'claim_token_hash') ||
        jsonb_build_object('claim_status','claimed','claimed_at',now()),
      updated_at=now()
  where id=p_order_id;

  update public.entitlements
  set user_id=p_user_id
  where order_id=p_order_id
    and (user_id is null or user_id=p_user_id);
  get diagnostics v_entitlements = row_count;

  update public.tickets
  set holder_user_id=p_user_id
  where order_id=p_order_id
    and (holder_user_id is null or holder_user_id=p_user_id);
  get diagnostics v_tickets = row_count;

  return jsonb_build_object(
    'order_id',p_order_id,
    'user_id',p_user_id,
    'claimed',true,
    'idempotent',false,
    'entitlements_attached',v_entitlements,
    'tickets_attached',v_tickets
  );
end;
$$;

revoke all on function private.claim_event_order_entitlements(uuid,uuid,text) from public;

create or replace function public.event_os_claim_order_entitlements(
  p_order_id uuid,
  p_user_id uuid,
  p_claim_hash text
) returns jsonb
language sql
security definer
set search_path=public,private,pg_catalog
as $$
  select private.claim_event_order_entitlements(p_order_id,p_user_id,p_claim_hash);
$$;

revoke all on function public.event_os_claim_order_entitlements(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.event_os_claim_order_entitlements(uuid,uuid,text) to service_role;

commit;
