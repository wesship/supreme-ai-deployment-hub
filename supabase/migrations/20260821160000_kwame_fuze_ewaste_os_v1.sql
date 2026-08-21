-- Kwame Fuze / D3VONN E-Waste OS v1
-- Direct-transfer/no-storage operating model.
-- Regulatory classification and authorization remain subject to Ghana EPA confirmation.

create sequence if not exists public.ewaste_transaction_number_seq;

create table if not exists public.ewaste_organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  country text not null default 'GH',
  operating_model text not null default 'direct_transfer_no_storage',
  regulatory_status text not null default 'pending_classification' check (regulatory_status in ('pending_classification','application_submitted','authorized','suspended','expired')),
  registration_number text,
  tax_id text,
  registered_address text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (legal_name, country)
);

create table if not exists public.ewaste_org_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ewaste_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','operations','compliance','finance','viewer')),
  status text not null default 'active' check (status in ('invited','active','suspended','removed')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create schema if not exists private;
create or replace function private.ewaste_is_member(p_org uuid, p_roles text[] default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ewaste_org_members m
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (p_roles is null or m.role = any(p_roles))
  );
$$;
revoke all on function private.ewaste_is_member(uuid, text[]) from public;

create table if not exists public.ewaste_suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ewaste_organizations(id) on delete cascade,
  supplier_code text not null,
  legal_name text not null,
  supplier_type text not null check (supplier_type in ('corporate','institutional','telecom','itad','collector','repair_refurbishment','scrap_dealer','government','other')),
  country text not null default 'GH', region text, city text,
  contact_name text, phone text, email text,
  status text not null default 'pending' check (status in ('pending','under_review','approved','enhanced_dd','suspended','rejected')),
  provenance_status text not null default 'pending' check (provenance_status in ('pending','verified','conditional','failed')),
  risk_score numeric(5,2) check (risk_score between 0 and 100),
  approved_material_classes text[] not null default '{}',
  kyc_data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, supplier_code)
);

create table if not exists public.ewaste_material_classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ewaste_organizations(id) on delete cascade,
  code text not null, name text not null, description text,
  unit text not null default 'kg', active boolean not null default true,
  valuation_policy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), unique (organization_id, code)
);

create table if not exists public.ewaste_processors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ewaste_organizations(id) on delete cascade,
  legal_name text not null, facility_name text, country text not null default 'GH', region text, city text,
  authorization_type text, authorization_number text, authorization_expires_at date,
  status text not null default 'unverified' check (status in ('unverified','verified','expiring','expired','suspended')),
  permitted_activities text[] not null default '{}', accepted_material_classes text[] not null default '{}', assay_method text,
  commercial_terms jsonb not null default '{}'::jsonb, verification_evidence jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.ewaste_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ewaste_organizations(id) on delete cascade,
  transaction_code text not null unique default ('KF-' || to_char(current_date,'YYYY') || '-' || lpad(nextval('public.ewaste_transaction_number_seq')::text, 6, '0')),
  supplier_id uuid not null references public.ewaste_suppliers(id), material_class_id uuid references public.ewaste_material_classes(id), processor_id uuid references public.ewaste_processors(id),
  status text not null default 'draft' check (status in ('draft','compliance_hold','approved','in_transit','received','assay_pending','settled','rejected','cancelled')),
  compliance_state text not null default 'pending' check (compliance_state in ('pending','passed','blocked','review_required')),
  provenance_state text not null default 'pending' check (provenance_state in ('pending','verified','conditional','failed')),
  material_description text, gross_weight_kg numeric(14,3) check (gross_weight_kg is null or gross_weight_kg >= 0),
  expected_purchase_value numeric(18,2) check (expected_purchase_value is null or expected_purchase_value >= 0),
  expected_settlement_value numeric(18,2) check (expected_settlement_value is null or expected_settlement_value >= 0),
  expected_total_cost numeric(18,2) check (expected_total_cost is null or expected_total_cost >= 0), expected_net_contribution numeric(18,2),
  actual_purchase_value numeric(18,2) check (actual_purchase_value is null or actual_purchase_value >= 0),
  actual_settlement_value numeric(18,2) check (actual_settlement_value is null or actual_settlement_value >= 0),
  actual_total_cost numeric(18,2) check (actual_total_cost is null or actual_total_cost >= 0), actual_net_contribution numeric(18,2),
  decision text check (decision is null or decision in ('buy','negotiate','reject')), decision_confidence numeric(5,2) check (decision_confidence is null or decision_confidence between 0 and 100),
  source_location text, destination_location text, notes text, metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.ewaste_transaction_documents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ewaste_organizations(id) on delete cascade,
  transaction_id uuid not null references public.ewaste_transactions(id) on delete cascade,
  document_type text not null check (document_type in ('supplier_identity','source_declaration','ownership_proof','weight_ticket','photo','transport_record','processor_intake','assay','settlement','invoice','payment','insurance','epa','other')),
  storage_path text, document_hash text,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected','expired')),
  metadata jsonb not null default '{}'::jsonb, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);

create table if not exists public.ewaste_transport_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ewaste_organizations(id) on delete cascade,
  transaction_id uuid not null references public.ewaste_transactions(id) on delete cascade,
  carrier_name text, carrier_reference text, driver_reference text, vehicle_reference text, origin text, destination text,
  departed_at timestamptz, arrived_at timestamptz,
  status text not null default 'planned' check (status in ('planned','dispatched','in_transit','delivered','exception','cancelled')),
  evidence jsonb not null default '{}'::jsonb, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);

create table if not exists public.ewaste_processor_intakes (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ewaste_organizations(id) on delete cascade,
  transaction_id uuid not null references public.ewaste_transactions(id) on delete cascade,
  processor_id uuid not null references public.ewaste_processors(id), intake_reference text not null,
  received_weight_kg numeric(14,3) check (received_weight_kg >= 0), received_at timestamptz not null default now(), condition_notes text,
  intake_status text not null default 'received' check (intake_status in ('received','accepted','partially_accepted','rejected','disputed')),
  evidence jsonb not null default '{}'::jsonb, created_by uuid references auth.users(id), created_at timestamptz not null default now(),
  unique (processor_id, intake_reference)
);

create table if not exists public.ewaste_assays (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ewaste_organizations(id) on delete cascade,
  transaction_id uuid not null references public.ewaste_transactions(id) on delete cascade, processor_intake_id uuid references public.ewaste_processor_intakes(id),
  assay_reference text not null, assay_method text,
  gold_grams numeric(18,6) check (gold_grams is null or gold_grams >= 0), silver_grams numeric(18,6) check (silver_grams is null or silver_grams >= 0), platinum_grams numeric(18,6) check (platinum_grams is null or platinum_grams >= 0),
  payable_value numeric(18,2) check (payable_value is null or payable_value >= 0), deductions numeric(18,2) default 0 check (deductions >= 0), net_payable numeric(18,2), assay_date date,
  status text not null default 'pending' check (status in ('pending','final','disputed','void')), evidence jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id), created_at timestamptz not null default now()
);

create table if not exists public.ewaste_settlements (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ewaste_organizations(id) on delete cascade,
  transaction_id uuid not null references public.ewaste_transactions(id) on delete cascade, assay_id uuid references public.ewaste_assays(id),
  settlement_reference text not null unique, currency text not null default 'USD', gross_amount numeric(18,2) not null default 0 check (gross_amount >= 0), deductions numeric(18,2) not null default 0 check (deductions >= 0), net_amount numeric(18,2) not null default 0 check (net_amount >= 0),
  payment_status text not null default 'pending' check (payment_status in ('pending','scheduled','paid','failed','disputed')), bank_reference text, paid_at timestamptz,
  evidence jsonb not null default '{}'::jsonb, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);

create table if not exists public.ewaste_transaction_events (
  id bigint generated always as identity primary key, organization_id uuid not null references public.ewaste_organizations(id) on delete cascade,
  transaction_id uuid not null references public.ewaste_transactions(id) on delete cascade, event_type text not null,
  actor_type text not null check (actor_type in ('human','agent','system')), actor_id text, from_status text, to_status text, reason text,
  evidence jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table if not exists public.ewaste_compliance_checks (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ewaste_organizations(id) on delete cascade,
  transaction_id uuid references public.ewaste_transactions(id) on delete cascade, check_key text not null,
  decision text not null check (decision in ('pass','warn','block','review_required')), finding text, recommendation text,
  evidence jsonb not null default '{}'::jsonb, checked_by text not null default 'system', created_at timestamptz not null default now()
);

create table if not exists public.ewaste_insurance_records (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ewaste_organizations(id) on delete cascade,
  policy_type text not null, insurer text, policy_number text, effective_from date, expires_at date, coverage_summary text,
  status text not null default 'pending' check (status in ('pending','active','expired','cancelled')), evidence jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create index if not exists ewaste_suppliers_org_status_idx on public.ewaste_suppliers(organization_id,status);
create index if not exists ewaste_transactions_org_status_idx on public.ewaste_transactions(organization_id,status,created_at desc);
create index if not exists ewaste_transactions_supplier_idx on public.ewaste_transactions(supplier_id,created_at desc);
create index if not exists ewaste_transaction_docs_tx_idx on public.ewaste_transaction_documents(transaction_id,created_at desc);
create index if not exists ewaste_transport_tx_idx on public.ewaste_transport_events(transaction_id,created_at desc);
create index if not exists ewaste_assays_tx_idx on public.ewaste_assays(transaction_id,created_at desc);
create index if not exists ewaste_settlements_tx_idx on public.ewaste_settlements(transaction_id,created_at desc);
create index if not exists ewaste_compliance_tx_idx on public.ewaste_compliance_checks(transaction_id,created_at desc);

create or replace function public.ewaste_set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists ewaste_organizations_updated_at on public.ewaste_organizations;
create trigger ewaste_organizations_updated_at before update on public.ewaste_organizations for each row execute function public.ewaste_set_updated_at();
drop trigger if exists ewaste_suppliers_updated_at on public.ewaste_suppliers;
create trigger ewaste_suppliers_updated_at before update on public.ewaste_suppliers for each row execute function public.ewaste_set_updated_at();
drop trigger if exists ewaste_processors_updated_at on public.ewaste_processors;
create trigger ewaste_processors_updated_at before update on public.ewaste_processors for each row execute function public.ewaste_set_updated_at();
drop trigger if exists ewaste_transactions_updated_at on public.ewaste_transactions;
create trigger ewaste_transactions_updated_at before update on public.ewaste_transactions for each row execute function public.ewaste_set_updated_at();

alter table public.ewaste_organizations enable row level security;
alter table public.ewaste_org_members enable row level security;
alter table public.ewaste_suppliers enable row level security;
alter table public.ewaste_material_classes enable row level security;
alter table public.ewaste_processors enable row level security;
alter table public.ewaste_transactions enable row level security;
alter table public.ewaste_transaction_documents enable row level security;
alter table public.ewaste_transport_events enable row level security;
alter table public.ewaste_processor_intakes enable row level security;
alter table public.ewaste_assays enable row level security;
alter table public.ewaste_settlements enable row level security;
alter table public.ewaste_transaction_events enable row level security;
alter table public.ewaste_compliance_checks enable row level security;
alter table public.ewaste_insurance_records enable row level security;

create policy ewaste_org_member_select on public.ewaste_organizations for select using (private.ewaste_is_member(id));
create policy ewaste_org_admin_write on public.ewaste_organizations for all using (private.ewaste_is_member(id, array['owner','admin'])) with check (private.ewaste_is_member(id, array['owner','admin']));
create policy ewaste_members_select on public.ewaste_org_members for select using (private.ewaste_is_member(organization_id));
create policy ewaste_members_admin on public.ewaste_org_members for all using (private.ewaste_is_member(organization_id, array['owner','admin'])) with check (private.ewaste_is_member(organization_id, array['owner','admin']));
create policy ewaste_suppliers_member on public.ewaste_suppliers for select using (private.ewaste_is_member(organization_id));
create policy ewaste_suppliers_ops on public.ewaste_suppliers for all using (private.ewaste_is_member(organization_id, array['owner','admin','operations','compliance'])) with check (private.ewaste_is_member(organization_id, array['owner','admin','operations','compliance']));
create policy ewaste_material_member on public.ewaste_material_classes for select using (private.ewaste_is_member(organization_id));
create policy ewaste_material_admin on public.ewaste_material_classes for all using (private.ewaste_is_member(organization_id, array['owner','admin','operations','compliance'])) with check (private.ewaste_is_member(organization_id, array['owner','admin','operations','compliance']));
create policy ewaste_processors_member on public.ewaste_processors for select using (private.ewaste_is_member(organization_id));
create policy ewaste_processors_compliance on public.ewaste_processors for all using (private.ewaste_is_member(organization_id, array['owner','admin','operations','compliance'])) with check (private.ewaste_is_member(organization_id, array['owner','admin','operations','compliance']));
create policy ewaste_transactions_member on public.ewaste_transactions for select using (private.ewaste_is_member(organization_id));
create policy ewaste_transactions_ops on public.ewaste_transactions for all using (private.ewaste_is_member(organization_id, array['owner','admin','operations','compliance'])) with check (private.ewaste_is_member(organization_id, array['owner','admin','operations','compliance']));
create policy ewaste_docs_member on public.ewaste_transaction_documents for select using (private.ewaste_is_member(organization_id));
create policy ewaste_docs_ops on public.ewaste_transaction_documents for all using (private.ewaste_is_member(organization_id, array['owner','admin','operations','compliance'])) with check (private.ewaste_is_member(organization_id, array['owner','admin','operations','compliance']));
create policy ewaste_transport_member on public.ewaste_transport_events for select using (private.ewaste_is_member(organization_id));
create policy ewaste_transport_ops on public.ewaste_transport_events for all using (private.ewaste_is_member(organization_id, array['owner','admin','operations'])) with check (private.ewaste_is_member(organization_id, array['owner','admin','operations']));
create policy ewaste_intake_member on public.ewaste_processor_intakes for select using (private.ewaste_is_member(organization_id));
create policy ewaste_intake_ops on public.ewaste_processor_intakes for all using (private.ewaste_is_member(organization_id, array['owner','admin','operations','compliance'])) with check (private.ewaste_is_member(organization_id, array['owner','admin','operations','compliance']));
create policy ewaste_assays_member on public.ewaste_assays for select using (private.ewaste_is_member(organization_id));
create policy ewaste_assays_ops on public.ewaste_assays for all using (private.ewaste_is_member(organization_id, array['owner','admin','operations','finance','compliance'])) with check (private.ewaste_is_member(organization_id, array['owner','admin','operations','finance','compliance']));
create policy ewaste_settlements_member on public.ewaste_settlements for select using (private.ewaste_is_member(organization_id));
create policy ewaste_settlements_finance on public.ewaste_settlements for all using (private.ewaste_is_member(organization_id, array['owner','admin','finance'])) with check (private.ewaste_is_member(organization_id, array['owner','admin','finance']));
create policy ewaste_events_member on public.ewaste_transaction_events for select using (private.ewaste_is_member(organization_id));
create policy ewaste_events_write on public.ewaste_transaction_events for insert with check (private.ewaste_is_member(organization_id, array['owner','admin','operations','compliance','finance']));
create policy ewaste_checks_member on public.ewaste_compliance_checks for select using (private.ewaste_is_member(organization_id));
create policy ewaste_checks_write on public.ewaste_compliance_checks for all using (private.ewaste_is_member(organization_id, array['owner','admin','compliance'])) with check (private.ewaste_is_member(organization_id, array['owner','admin','compliance']));
create policy ewaste_insurance_member on public.ewaste_insurance_records for select using (private.ewaste_is_member(organization_id));
create policy ewaste_insurance_admin on public.ewaste_insurance_records for all using (private.ewaste_is_member(organization_id, array['owner','admin','compliance'])) with check (private.ewaste_is_member(organization_id, array['owner','admin','compliance']));

create or replace view public.ewaste_transaction_margin_view with (security_invoker = true) as
select t.id,t.organization_id,t.transaction_code,t.status,t.compliance_state,t.gross_weight_kg,
coalesce(t.expected_settlement_value,0)-coalesce(t.expected_purchase_value,0)-coalesce(t.expected_total_cost,0) as expected_net_contribution_calc,
coalesce(t.actual_settlement_value,0)-coalesce(t.actual_purchase_value,0)-coalesce(t.actual_total_cost,0) as actual_net_contribution_calc,
case when coalesce(t.expected_purchase_value,0)>0 then ((coalesce(t.expected_settlement_value,0)-coalesce(t.expected_purchase_value,0)-coalesce(t.expected_total_cost,0))/t.expected_purchase_value)*100 else null end as expected_roi_pct
from public.ewaste_transactions t;

comment on table public.ewaste_transactions is 'Traceable e-waste aggregation transactions for the direct-transfer/no-storage operating model. Regulatory classification remains subject to Ghana EPA confirmation.';
comment on table public.ewaste_transaction_events is 'Append-oriented transaction audit trail for chain-of-custody and human/agent/system actions.';
comment on table public.ewaste_compliance_checks is 'Compliance gate evidence; a block/review_required result must prevent transaction approval in application logic.';