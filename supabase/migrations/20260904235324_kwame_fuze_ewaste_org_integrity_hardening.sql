-- E-waste OS forward hardening.
-- Prevents cross-organization references even when a caller knows another tenant's UUID.
-- This schema is optional in clean preview branches, so fail closed by skipping the
-- hardening migration unless the complete e-waste table set is already installed.

do $$
declare
  required_tables text[] := array[
    'public.ewaste_suppliers',
    'public.ewaste_material_classes',
    'public.ewaste_processors',
    'public.ewaste_transactions',
    'public.ewaste_transaction_documents',
    'public.ewaste_transport_events',
    'public.ewaste_processor_intakes',
    'public.ewaste_assays',
    'public.ewaste_settlements',
    'public.ewaste_transaction_events',
    'public.ewaste_compliance_checks'
  ];
  table_name text;
begin
  foreach table_name in array required_tables loop
    if to_regclass(table_name) is null then
      raise notice 'Skipping e-waste org integrity hardening because optional table % is absent', table_name;
      return;
    end if;
  end loop;

  execute 'create unique index if not exists ewaste_suppliers_id_org_uidx on public.ewaste_suppliers(id, organization_id)';
  execute 'create unique index if not exists ewaste_material_classes_id_org_uidx on public.ewaste_material_classes(id, organization_id)';
  execute 'create unique index if not exists ewaste_processors_id_org_uidx on public.ewaste_processors(id, organization_id)';
  execute 'create unique index if not exists ewaste_transactions_id_org_uidx on public.ewaste_transactions(id, organization_id)';
  execute 'create unique index if not exists ewaste_processor_intakes_id_org_uidx on public.ewaste_processor_intakes(id, organization_id)';
  execute 'create unique index if not exists ewaste_assays_id_org_uidx on public.ewaste_assays(id, organization_id)';

  if not exists (select 1 from pg_constraint where conname = 'ewaste_transactions_supplier_org_fkey') then
    alter table public.ewaste_transactions add constraint ewaste_transactions_supplier_org_fkey
      foreign key (supplier_id, organization_id) references public.ewaste_suppliers(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_transactions_material_org_fkey') then
    alter table public.ewaste_transactions add constraint ewaste_transactions_material_org_fkey
      foreign key (material_class_id, organization_id) references public.ewaste_material_classes(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_transactions_processor_org_fkey') then
    alter table public.ewaste_transactions add constraint ewaste_transactions_processor_org_fkey
      foreign key (processor_id, organization_id) references public.ewaste_processors(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_transaction_documents_tx_org_fkey') then
    alter table public.ewaste_transaction_documents add constraint ewaste_transaction_documents_tx_org_fkey
      foreign key (transaction_id, organization_id) references public.ewaste_transactions(id, organization_id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_transport_events_tx_org_fkey') then
    alter table public.ewaste_transport_events add constraint ewaste_transport_events_tx_org_fkey
      foreign key (transaction_id, organization_id) references public.ewaste_transactions(id, organization_id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_processor_intakes_tx_org_fkey') then
    alter table public.ewaste_processor_intakes add constraint ewaste_processor_intakes_tx_org_fkey
      foreign key (transaction_id, organization_id) references public.ewaste_transactions(id, organization_id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_processor_intakes_processor_org_fkey') then
    alter table public.ewaste_processor_intakes add constraint ewaste_processor_intakes_processor_org_fkey
      foreign key (processor_id, organization_id) references public.ewaste_processors(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_assays_tx_org_fkey') then
    alter table public.ewaste_assays add constraint ewaste_assays_tx_org_fkey
      foreign key (transaction_id, organization_id) references public.ewaste_transactions(id, organization_id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_assays_intake_org_fkey') then
    alter table public.ewaste_assays add constraint ewaste_assays_intake_org_fkey
      foreign key (processor_intake_id, organization_id) references public.ewaste_processor_intakes(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_settlements_tx_org_fkey') then
    alter table public.ewaste_settlements add constraint ewaste_settlements_tx_org_fkey
      foreign key (transaction_id, organization_id) references public.ewaste_transactions(id, organization_id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_settlements_assay_org_fkey') then
    alter table public.ewaste_settlements add constraint ewaste_settlements_assay_org_fkey
      foreign key (assay_id, organization_id) references public.ewaste_assays(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_transaction_events_tx_org_fkey') then
    alter table public.ewaste_transaction_events add constraint ewaste_transaction_events_tx_org_fkey
      foreign key (transaction_id, organization_id) references public.ewaste_transactions(id, organization_id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_compliance_checks_tx_org_fkey') then
    alter table public.ewaste_compliance_checks add constraint ewaste_compliance_checks_tx_org_fkey
      foreign key (transaction_id, organization_id) references public.ewaste_transactions(id, organization_id) on delete cascade;
  end if;

  comment on constraint ewaste_transactions_supplier_org_fkey on public.ewaste_transactions
    is 'Prevents cross-organization supplier linkage.';
  comment on constraint ewaste_transactions_processor_org_fkey on public.ewaste_transactions
    is 'Prevents cross-organization processor linkage.';
  comment on constraint ewaste_transaction_documents_tx_org_fkey on public.ewaste_transaction_documents
    is 'Keeps transaction evidence in the same organization as its transaction.';
end
$$;
