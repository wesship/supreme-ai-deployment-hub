-- D3VONN Event OS foundation + checkout transaction core
-- Canonical tenant boundary uses primetime_workspaces because it exists in both
-- staging and production. Browser clients receive read-only/public data through
-- governed application routes; consequential writes are backend/service-role only.

begin;

create schema if not exists private;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  title text not null,
  slug text not null,
  description text,
  event_type text not null,
  status text not null default 'draft' check (status in ('draft','scheduled','on_sale','live','completed','cancelled','archived')),
  visibility text not null default 'public' check (visibility in ('public','private','invite_only')),
  start_at timestamptz not null,
  end_at timestamptz,
  timezone text not null default 'America/Denver',
  venue_name text,
  venue_address jsonb,
  virtual_url text,
  capacity integer check (capacity is null or capacity >= 0),
  hero_image_url text,
  trailer_url text,
  ticketing_enabled boolean not null default true,
  streaming_enabled boolean not null default false,
  merch_enabled boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, slug)
);

create table if not exists public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  code text not null,
  description text,
  price_cents bigint not null check (price_cents >= 0),
  currency text not null default 'USD',
  inventory_total integer,
  inventory_reserved integer not null default 0 check (inventory_reserved >= 0),
  inventory_sold integer not null default 0 check (inventory_sold >= 0),
  sales_start_at timestamptz,
  sales_end_at timestamptz,
  access_level text not null default 'general',
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, code),
  check (inventory_total is null or inventory_total >= 0),
  check (inventory_total is null or inventory_reserved + inventory_sold <= inventory_total)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  product_type text not null check (product_type in ('physical','digital','ticket','membership','bundle','experience')),
  name text not null,
  slug text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','active','inactive','archived')),
  price_cents bigint not null default 0 check (price_cents >= 0),
  currency text not null default 'USD',
  cover_url text,
  fulfillment_mode text not null default 'none' check (fulfillment_mode in ('none','shipping','download','stream','entitlement')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, slug)
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sku text,
  title text not null,
  attributes jsonb not null default '{}'::jsonb,
  price_cents bigint,
  inventory_total integer,
  inventory_reserved integer not null default 0,
  inventory_sold integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(workspace_id, sku),
  check (price_cents is null or price_cents >= 0),
  check (inventory_total is null or inventory_total >= 0),
  check (inventory_reserved >= 0 and inventory_sold >= 0),
  check (inventory_total is null or inventory_reserved + inventory_sold <= inventory_total)
);

create table if not exists public.event_products (
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  featured boolean not null default false,
  sort_order integer not null default 0,
  primary key(event_id, product_id)
);

create table if not exists public.bundles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  price_cents bigint not null check (price_cents >= 0),
  currency text not null default 'USD',
  inventory_total integer,
  inventory_reserved integer not null default 0 check (inventory_reserved >= 0),
  inventory_sold integer not null default 0,
  status text not null default 'draft' check (status in ('draft','active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, slug),
  check (inventory_total is null or inventory_total >= 0),
  check (inventory_total is null or inventory_reserved + inventory_sold <= inventory_total)
);

create table if not exists public.bundle_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  bundle_id uuid not null references public.bundles(id) on delete cascade,
  item_type text not null check (item_type in ('product','variant','ticket_type','entitlement')),
  product_id uuid references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  ticket_type_id uuid references public.ticket_types(id) on delete cascade,
  entitlement_key text,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  check (
    (case when product_id is not null then 1 else 0 end) +
    (case when variant_id is not null then 1 else 0 end) +
    (case when ticket_type_id is not null then 1 else 0 end) +
    (case when entitlement_key is not null then 1 else 0 end) = 1
  )
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  purchaser_user_id uuid references auth.users(id) on delete set null,
  purchaser_email text not null,
  status text not null default 'pending' check (status in ('pending','payment_pending','paid','partially_refunded','refunded','cancelled','failed')),
  currency text not null default 'USD',
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  shipping_cents bigint not null default 0 check (shipping_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  external_checkout_id text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, idempotency_key)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  item_type text not null check (item_type in ('product','variant','ticket_type','bundle')),
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  ticket_type_id uuid references public.ticket_types(id) on delete set null,
  bundle_id uuid references public.bundles(id) on delete set null,
  title_snapshot text not null,
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity > 0),
  line_total_cents bigint not null check (line_total_cents >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'stripe',
  provider_payment_id text,
  provider_checkout_id text,
  status text not null default 'pending' check (status in ('pending','requires_action','processing','succeeded','partially_refunded','refunded','failed','cancelled')),
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'USD',
  captured_at timestamptz,
  refunded_cents bigint not null default 0 check (refunded_cents >= 0),
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_payment_id)
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid references public.order_items(id) on delete set null,
  holder_user_id uuid references auth.users(id) on delete set null,
  holder_name text,
  holder_email text not null,
  ticket_code text not null,
  qr_token_hash text not null,
  status text not null default 'issued' check (status in ('issued','checked_in','cancelled','refunded','void')),
  issued_at timestamptz not null default now(),
  checked_in_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique(event_id, ticket_code),
  unique(qr_token_hash)
);

create table if not exists public.ticket_checkins (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  scanned_by uuid references auth.users(id) on delete set null,
  result text not null check (result in ('accepted','duplicate','rejected','override')),
  scanned_at timestamptz not null default now(),
  device_id text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  order_item_id uuid references public.order_items(id) on delete set null,
  event_id uuid references public.events(id) on delete cascade,
  entitlement_type text not null check (entitlement_type in ('download','stream','replay','vip','backstage','membership','digital_asset')),
  entitlement_key text not null,
  status text not null default 'active' check (status in ('active','revoked','expired')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.event_streams (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  provider text not null default 'mediamtx',
  playback_path text not null,
  required_entitlement_key text,
  status text not null default 'offline' check (status in ('offline','scheduled','live','ended','error')),
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, playback_path)
);

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  resource_type text not null check (resource_type in ('variant','ticket_type','bundle')),
  resource_id uuid not null,
  quantity integer not null check (quantity > 0),
  status text not null default 'active' check (status in ('active','consumed','released','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_item_id, resource_type, resource_id)
);

create table if not exists public.fulfillment_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete cascade,
  job_type text not null check (job_type in ('issue_ticket','grant_entitlement','ship_merch','explode_bundle','notify_customer','emit_hermes_event')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  payload jsonb not null default '{}'::jsonb,
  last_error text,
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  signature_valid boolean not null default false,
  amount_cents bigint,
  currency text,
  payload_sha256 text not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);

create index if not exists events_workspace_status_idx on public.events(workspace_id, status);
create index if not exists ticket_types_event_idx on public.ticket_types(event_id, is_active);
create index if not exists products_workspace_status_idx on public.products(workspace_id, status);
create index if not exists product_variants_product_idx on public.product_variants(product_id);
create index if not exists bundles_event_idx on public.bundles(event_id) where event_id is not null;
create index if not exists orders_workspace_created_idx on public.orders(workspace_id, created_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists payments_order_idx on public.payments(order_id, status);
create index if not exists tickets_event_status_idx on public.tickets(event_id, status);
create index if not exists ticket_checkins_ticket_idx on public.ticket_checkins(ticket_id, scanned_at desc);
create index if not exists entitlements_user_status_idx on public.entitlements(user_id, status) where user_id is not null;
create index if not exists inventory_reservations_order_idx on public.inventory_reservations(order_id, status);
create index if not exists inventory_reservations_expiry_idx on public.inventory_reservations(status, expires_at);
create index if not exists fulfillment_jobs_queue_idx on public.fulfillment_jobs(status, available_at);
create index if not exists payment_events_order_idx on public.payment_events(order_id, created_at desc);
create unique index if not exists fulfillment_jobs_unique_item_job on public.fulfillment_jobs(order_id, order_item_id, job_type) where order_item_id is not null;
create unique index if not exists fulfillment_jobs_unique_order_job on public.fulfillment_jobs(order_id, job_type) where order_item_id is null;

alter table public.events enable row level security;
alter table public.ticket_types enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.event_products enable row level security;
alter table public.bundles enable row level security;
alter table public.bundle_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_checkins enable row level security;
alter table public.entitlements enable row level security;
alter table public.event_streams enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.fulfillment_jobs enable row level security;
alter table public.payment_events enable row level security;

revoke all on public.inventory_reservations from anon, authenticated;
revoke all on public.fulfillment_jobs from anon, authenticated;
revoke all on public.payment_events from anon, authenticated;

drop policy if exists "events_public_read" on public.events;
create policy "events_public_read" on public.events for select to anon, authenticated
using (visibility='public' and status in ('scheduled','on_sale','live','completed'));

drop policy if exists "events_workspace_member_read" on public.events;
create policy "events_workspace_member_read" on public.events for select to authenticated
using (exists (
  select 1 from public.primetime_workspace_memberships wm
  where wm.workspace_id=events.workspace_id
    and wm.user_id=(select auth.uid())
    and wm.status='active'
));

drop policy if exists "ticket_types_public_read" on public.ticket_types;
create policy "ticket_types_public_read" on public.ticket_types for select to anon, authenticated
using (
  is_active and exists (
    select 1 from public.events e
    where e.id=ticket_types.event_id
      and e.visibility='public'
      and e.status in ('scheduled','on_sale','live')
  )
);

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products for select to anon, authenticated using (status='active');

drop policy if exists "product_variants_public_read" on public.product_variants;
create policy "product_variants_public_read" on public.product_variants for select to anon, authenticated
using (is_active and exists (select 1 from public.products p where p.id=product_variants.product_id and p.status='active'));

drop policy if exists "event_products_public_read" on public.event_products;
create policy "event_products_public_read" on public.event_products for select to anon, authenticated
using (exists (
  select 1 from public.events e
  where e.id=event_products.event_id and e.visibility='public' and e.status in ('scheduled','on_sale','live','completed')
));

drop policy if exists "bundles_public_read" on public.bundles;
create policy "bundles_public_read" on public.bundles for select to anon, authenticated using (status='active');

drop policy if exists "bundle_items_public_read" on public.bundle_items;
create policy "bundle_items_public_read" on public.bundle_items for select to anon, authenticated
using (exists (select 1 from public.bundles b where b.id=bundle_items.bundle_id and b.status='active'));

drop policy if exists "orders_owner_read" on public.orders;
create policy "orders_owner_read" on public.orders for select to authenticated
using (purchaser_user_id=(select auth.uid()));

drop policy if exists "order_items_owner_read" on public.order_items;
create policy "order_items_owner_read" on public.order_items for select to authenticated
using (exists (select 1 from public.orders o where o.id=order_items.order_id and o.purchaser_user_id=(select auth.uid())));

drop policy if exists "payments_owner_read" on public.payments;
create policy "payments_owner_read" on public.payments for select to authenticated
using (exists (select 1 from public.orders o where o.id=payments.order_id and o.purchaser_user_id=(select auth.uid())));

drop policy if exists "tickets_holder_read" on public.tickets;
create policy "tickets_holder_read" on public.tickets for select to authenticated
using (
  holder_user_id=(select auth.uid())
  or exists (select 1 from public.orders o where o.id=tickets.order_id and o.purchaser_user_id=(select auth.uid()))
);

drop policy if exists "ticket_checkins_workspace_member_read" on public.ticket_checkins;
create policy "ticket_checkins_workspace_member_read" on public.ticket_checkins for select to authenticated
using (exists (
  select 1 from public.primetime_workspace_memberships wm
  where wm.workspace_id=ticket_checkins.workspace_id
    and wm.user_id=(select auth.uid())
    and wm.status='active'
));

drop policy if exists "entitlements_owner_read" on public.entitlements;
create policy "entitlements_owner_read" on public.entitlements for select to authenticated using (user_id=(select auth.uid()));

drop policy if exists "event_streams_public_metadata_read" on public.event_streams;
create policy "event_streams_public_metadata_read" on public.event_streams for select to anon, authenticated
using (exists (
  select 1 from public.events e
  where e.id=event_streams.event_id and e.visibility='public' and e.status in ('scheduled','on_sale','live','completed')
));

create or replace function private.reserve_event_order_inventory(
  p_order_id uuid,
  p_hold_minutes integer default 30
) returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_catalog
as $$
declare
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_bundle_item public.bundle_items%rowtype;
  v_available integer;
  v_expires timestamptz := now() + make_interval(mins => greatest(1,least(p_hold_minutes,120)));
  v_existing_expires timestamptz;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status not in ('pending','payment_pending') then raise exception 'order_not_reservable:%',v_order.status; end if;

  select max(expires_at) into v_existing_expires
  from public.inventory_reservations where order_id=p_order_id and status='active';
  if v_existing_expires is not null then
    return jsonb_build_object('order_id',p_order_id,'status','reserved','expires_at',v_existing_expires,'idempotent',true);
  end if;

  for v_item in select * from public.order_items where order_id=p_order_id order by created_at,id
  loop
    if v_item.item_type='variant' and v_item.variant_id is not null then
      select case when inventory_total is null then null else inventory_total-inventory_reserved-inventory_sold end
      into v_available from public.product_variants where id=v_item.variant_id for update;
      if not found then raise exception 'variant_not_found:%',v_item.variant_id; end if;
      if v_available is not null and v_available<v_item.quantity then raise exception 'variant_sold_out:%',v_item.variant_id; end if;
      update public.product_variants set inventory_reserved=inventory_reserved+v_item.quantity where id=v_item.variant_id;
      insert into public.inventory_reservations(workspace_id,order_id,order_item_id,resource_type,resource_id,quantity,expires_at)
      values(v_order.workspace_id,p_order_id,v_item.id,'variant',v_item.variant_id,v_item.quantity,v_expires);
    elsif v_item.item_type='ticket_type' and v_item.ticket_type_id is not null then
      select case when inventory_total is null then null else inventory_total-inventory_reserved-inventory_sold end
      into v_available from public.ticket_types where id=v_item.ticket_type_id for update;
      if not found then raise exception 'ticket_type_not_found:%',v_item.ticket_type_id; end if;
      if v_available is not null and v_available<v_item.quantity then raise exception 'ticket_type_sold_out:%',v_item.ticket_type_id; end if;
      update public.ticket_types set inventory_reserved=inventory_reserved+v_item.quantity where id=v_item.ticket_type_id;
      insert into public.inventory_reservations(workspace_id,order_id,order_item_id,resource_type,resource_id,quantity,expires_at)
      values(v_order.workspace_id,p_order_id,v_item.id,'ticket_type',v_item.ticket_type_id,v_item.quantity,v_expires);
    elsif v_item.item_type='bundle' and v_item.bundle_id is not null then
      select case when inventory_total is null then null else inventory_total-inventory_reserved-inventory_sold end
      into v_available from public.bundles where id=v_item.bundle_id for update;
      if not found then raise exception 'bundle_not_found:%',v_item.bundle_id; end if;
      if v_available is not null and v_available<v_item.quantity then raise exception 'bundle_sold_out:%',v_item.bundle_id; end if;
      update public.bundles set inventory_reserved=inventory_reserved+v_item.quantity where id=v_item.bundle_id;
      insert into public.inventory_reservations(workspace_id,order_id,order_item_id,resource_type,resource_id,quantity,expires_at)
      values(v_order.workspace_id,p_order_id,v_item.id,'bundle',v_item.bundle_id,v_item.quantity,v_expires);

      for v_bundle_item in select * from public.bundle_items where bundle_id=v_item.bundle_id order by id
      loop
        if v_bundle_item.item_type='variant' and v_bundle_item.variant_id is not null then
          select case when inventory_total is null then null else inventory_total-inventory_reserved-inventory_sold end
          into v_available from public.product_variants where id=v_bundle_item.variant_id for update;
          if not found then raise exception 'bundle_variant_not_found:%',v_bundle_item.variant_id; end if;
          if v_available is not null and v_available<(v_bundle_item.quantity*v_item.quantity) then raise exception 'bundle_variant_sold_out:%',v_bundle_item.variant_id; end if;
          update public.product_variants set inventory_reserved=inventory_reserved+(v_bundle_item.quantity*v_item.quantity) where id=v_bundle_item.variant_id;
          insert into public.inventory_reservations(workspace_id,order_id,order_item_id,resource_type,resource_id,quantity,expires_at)
          values(v_order.workspace_id,p_order_id,v_item.id,'variant',v_bundle_item.variant_id,v_bundle_item.quantity*v_item.quantity,v_expires);
        elsif v_bundle_item.item_type='ticket_type' and v_bundle_item.ticket_type_id is not null then
          select case when inventory_total is null then null else inventory_total-inventory_reserved-inventory_sold end
          into v_available from public.ticket_types where id=v_bundle_item.ticket_type_id for update;
          if not found then raise exception 'bundle_ticket_type_not_found:%',v_bundle_item.ticket_type_id; end if;
          if v_available is not null and v_available<(v_bundle_item.quantity*v_item.quantity) then raise exception 'bundle_ticket_type_sold_out:%',v_bundle_item.ticket_type_id; end if;
          update public.ticket_types set inventory_reserved=inventory_reserved+(v_bundle_item.quantity*v_item.quantity) where id=v_bundle_item.ticket_type_id;
          insert into public.inventory_reservations(workspace_id,order_id,order_item_id,resource_type,resource_id,quantity,expires_at)
          values(v_order.workspace_id,p_order_id,v_item.id,'ticket_type',v_bundle_item.ticket_type_id,v_bundle_item.quantity*v_item.quantity,v_expires);
        end if;
      end loop;
    end if;
  end loop;

  update public.orders set status='payment_pending',updated_at=now() where id=p_order_id;
  return jsonb_build_object('order_id',p_order_id,'status','reserved','expires_at',v_expires,'idempotent',false);
end;
$$;

create or replace function private.release_event_order_inventory(
  p_order_id uuid,
  p_order_status text default 'cancelled'
) returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_catalog
as $$
declare
  v_order public.orders%rowtype;
  v_res public.inventory_reservations%rowtype;
  v_released integer := 0;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status='paid' then return jsonb_build_object('order_id',p_order_id,'status','paid','released',0,'idempotent',true); end if;

  for v_res in select * from public.inventory_reservations where order_id=p_order_id and status='active' order by created_at,id for update
  loop
    if v_res.resource_type='variant' then
      update public.product_variants set inventory_reserved=greatest(0,inventory_reserved-v_res.quantity) where id=v_res.resource_id;
    elsif v_res.resource_type='ticket_type' then
      update public.ticket_types set inventory_reserved=greatest(0,inventory_reserved-v_res.quantity) where id=v_res.resource_id;
    elsif v_res.resource_type='bundle' then
      update public.bundles set inventory_reserved=greatest(0,inventory_reserved-v_res.quantity) where id=v_res.resource_id;
    end if;
    update public.inventory_reservations
      set status=case when expires_at<now() then 'expired' else 'released' end,updated_at=now()
      where id=v_res.id;
    v_released:=v_released+1;
  end loop;

  update public.orders set status=case when p_order_status in ('cancelled','failed') then p_order_status else 'cancelled' end,updated_at=now()
  where id=p_order_id;
  return jsonb_build_object('order_id',p_order_id,'status',p_order_status,'released',v_released,'idempotent',v_released=0);
end;
$$;

create or replace function private.finalize_event_order_payment(
  p_order_id uuid,
  p_provider text,
  p_provider_payment_id text,
  p_provider_checkout_id text,
  p_amount_cents bigint,
  p_currency text
) returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_catalog
as $$
declare
  v_order public.orders%rowtype;
  v_payment_id uuid;
  v_res public.inventory_reservations%rowtype;
  v_item public.order_items%rowtype;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;

  if v_order.status='paid' then
    select id into v_payment_id from public.payments where provider=p_provider and provider_payment_id=p_provider_payment_id limit 1;
    return jsonb_build_object('order_id',p_order_id,'status','paid','payment_id',v_payment_id,'idempotent',true);
  end if;

  if upper(v_order.currency)<>upper(p_currency) then raise exception 'currency_mismatch'; end if;
  if v_order.total_cents<>p_amount_cents then raise exception 'amount_mismatch:expected %, got %',v_order.total_cents,p_amount_cents; end if;

  insert into public.payments(workspace_id,order_id,provider,provider_payment_id,provider_checkout_id,status,amount_cents,currency,captured_at)
  values(v_order.workspace_id,p_order_id,p_provider,p_provider_payment_id,p_provider_checkout_id,'succeeded',p_amount_cents,upper(p_currency),now())
  on conflict(provider,provider_payment_id) do update
  set status='succeeded',provider_checkout_id=excluded.provider_checkout_id,captured_at=coalesce(public.payments.captured_at,now()),updated_at=now()
  returning id into v_payment_id;

  for v_res in select * from public.inventory_reservations where order_id=p_order_id and status='active' order by created_at,id for update
  loop
    if v_res.expires_at<now() then raise exception 'reservation_expired:%',v_res.id; end if;
    if v_res.resource_type='variant' then
      update public.product_variants set inventory_reserved=inventory_reserved-v_res.quantity,inventory_sold=inventory_sold+v_res.quantity
      where id=v_res.resource_id and inventory_reserved>=v_res.quantity;
      if not found then raise exception 'variant_reservation_inconsistent:%',v_res.resource_id; end if;
    elsif v_res.resource_type='ticket_type' then
      update public.ticket_types set inventory_reserved=inventory_reserved-v_res.quantity,inventory_sold=inventory_sold+v_res.quantity
      where id=v_res.resource_id and inventory_reserved>=v_res.quantity;
      if not found then raise exception 'ticket_reservation_inconsistent:%',v_res.resource_id; end if;
    elsif v_res.resource_type='bundle' then
      update public.bundles set inventory_reserved=inventory_reserved-v_res.quantity,inventory_sold=inventory_sold+v_res.quantity
      where id=v_res.resource_id and inventory_reserved>=v_res.quantity;
      if not found then raise exception 'bundle_reservation_inconsistent:%',v_res.resource_id; end if;
    end if;
    update public.inventory_reservations set status='consumed',updated_at=now() where id=v_res.id;
  end loop;

  update public.orders set status='paid',external_checkout_id=coalesce(p_provider_checkout_id,external_checkout_id),updated_at=now() where id=p_order_id;

  for v_item in select * from public.order_items where order_id=p_order_id order by created_at,id
  loop
    if v_item.item_type='ticket_type' then
      insert into public.fulfillment_jobs(workspace_id,order_id,order_item_id,job_type,payload)
      values(v_order.workspace_id,p_order_id,v_item.id,'issue_ticket',jsonb_build_object('quantity',v_item.quantity,'ticket_type_id',v_item.ticket_type_id))
      on conflict do nothing;
    elsif v_item.item_type in ('product','variant') then
      insert into public.fulfillment_jobs(workspace_id,order_id,order_item_id,job_type,payload)
      values(v_order.workspace_id,p_order_id,v_item.id,
        case when coalesce((select p.fulfillment_mode from public.products p where p.id=v_item.product_id),'shipping')='shipping'
          then 'ship_merch' else 'grant_entitlement' end,
        jsonb_build_object('quantity',v_item.quantity,'product_id',v_item.product_id,'variant_id',v_item.variant_id))
      on conflict do nothing;
    elsif v_item.item_type='bundle' then
      insert into public.fulfillment_jobs(workspace_id,order_id,order_item_id,job_type,payload)
      values(v_order.workspace_id,p_order_id,v_item.id,'explode_bundle',jsonb_build_object('bundle_id',v_item.bundle_id,'quantity',v_item.quantity))
      on conflict do nothing;
    end if;
  end loop;

  insert into public.fulfillment_jobs(workspace_id,order_id,job_type,payload)
  values(v_order.workspace_id,p_order_id,'notify_customer',jsonb_build_object('email',v_order.purchaser_email))
  on conflict do nothing;

  insert into public.fulfillment_jobs(workspace_id,order_id,job_type,payload)
  values(v_order.workspace_id,p_order_id,'emit_hermes_event',jsonb_build_object('event','event_os.order_paid'))
  on conflict do nothing;

  return jsonb_build_object('order_id',p_order_id,'status','paid','payment_id',v_payment_id,'idempotent',false);
end;
$$;

revoke all on function private.reserve_event_order_inventory(uuid,integer) from public;
revoke all on function private.release_event_order_inventory(uuid,text) from public;
revoke all on function private.finalize_event_order_payment(uuid,text,text,text,bigint,text) from public;

create or replace function public.event_os_reserve_order_inventory(p_order_id uuid,p_hold_minutes integer default 30)
returns jsonb language sql security definer set search_path=public,private,pg_catalog
as $$ select private.reserve_event_order_inventory(p_order_id,p_hold_minutes); $$;

create or replace function public.event_os_release_order_inventory(p_order_id uuid,p_order_status text default 'cancelled')
returns jsonb language sql security definer set search_path=public,private,pg_catalog
as $$ select private.release_event_order_inventory(p_order_id,p_order_status); $$;

create or replace function public.event_os_finalize_order_payment(
  p_order_id uuid,p_provider text,p_provider_payment_id text,p_provider_checkout_id text,p_amount_cents bigint,p_currency text
) returns jsonb language sql security definer set search_path=public,private,pg_catalog
as $$ select private.finalize_event_order_payment(p_order_id,p_provider,p_provider_payment_id,p_provider_checkout_id,p_amount_cents,p_currency); $$;

revoke all on function public.event_os_reserve_order_inventory(uuid,integer) from public,anon,authenticated;
revoke all on function public.event_os_release_order_inventory(uuid,text) from public,anon,authenticated;
revoke all on function public.event_os_finalize_order_payment(uuid,text,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.event_os_reserve_order_inventory(uuid,integer) to service_role;
grant execute on function public.event_os_release_order_inventory(uuid,text) to service_role;
grant execute on function public.event_os_finalize_order_payment(uuid,text,text,text,bigint,text) to service_role;

comment on table public.inventory_reservations is 'Backend-only Event OS inventory holds. No direct browser access.';
comment on table public.fulfillment_jobs is 'Backend-only idempotent Event OS fulfillment queue.';
comment on table public.payment_events is 'Backend-only immutable Stripe/payment event ledger.';

commit;
