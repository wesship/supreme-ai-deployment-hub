-- E-waste OS forward hardening.
-- Prevents cross-organization references even when a caller knows another tenant's UUID.
-- Rehearsed successfully on D3VONN.IO staging before source-control promotion.

create unique index if not exists ewaste_suppliers_id_org_uidx
  on public.ewaste_suppliers(id, organization_id);
create unique index if not exists ewaste_material_classes_id_org_uidx
  on public.ewaste_material_classes(id, organization_id);
create unique index if not exists ewaste_processors_id_org_uidx
  on public.ewaste_processors(id, organization_id);
create unique index if not exists ewaste_transactions_id_org_uidx
  on public.ewaste_transactions(id, organization_id);
create unique index if not exists ewaste_processor_intakes_id_org_uidx
  on public.ewaste_processor_intakes(id, organization_id);
create unique index if not exists ewaste_assays_id_org_uidx
  on public.ewaste_assays(id, organization_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ewaste_transactions_supplier_org_fkey') then
    alter table public.ewaste_transactions
      add constraint ewaste_transactions_supplier_org_fkey
      foreign key (supplier_id, organization_id)
      references public.ewaste_suppliers(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_transactions_material_org_fkey') then
    alter table public.ewaste_transactions
      add constraint ewaste_transactions_material_org_fkey
      foreign key (material_class_id, organization_id)
      references public.ewaste_material_classes(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_transactions_processor_org_fkey') then
    alter table public.ewaste_transactions
      add constraint ewaste_transactions_processor_org_fkey
      foreign key (processor_id, organization_id)
      references public.ewaste_processors(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_transaction_documents_tx_org_fkey') then
    alter table public.ewaste_transaction_documents
      add constraint ewaste_transaction_documents_tx_org_fkey
      foreign key (transaction_id, organization_id)
      references public.ewaste_transactions(id, organization_id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_transport_events_tx_org_fkey') then
    alter table public.ewaste_transport_events
      add constraint ewaste_transport_events_tx_org_fkey
      foreign key (transaction_id, organization_id)
      references public.ewaste_transactions(id, organization_id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_processor_intakes_tx_org_fkey') then
    alter table public.ewaste_processor_intakes
      add constraint ewaste_processor_intakes_tx_org_fkey
      foreign key (transaction_id, organization_id)
      references public.ewaste_transactions(id, organization_id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_processor_intakes_processor_org_fkey') then
    alter table public.ewaste_processor_intakes
      add constraint ewaste_processor_intakes_processor_org_fkey
      foreign key (processor_id, organization_id)
      references public.ewaste_processors(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_assays_tx_org_fkey') then
    alter table public.ewaste_assays
      add constraint ewaste_assays_tx_org_fkey
      foreign key (transaction_id, organization_id)
      references public.ewaste_transactions(id, organization_id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_assays_intake_org_fkey') then
    alter table public.ewaste_assays
      add constraint ewaste_assays_intake_org_fkey
      foreign key (processor_intake_id, organization_id)
      references public.ewaste_processor_intakes(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_settlements_tx_org_fkey') then
    alter table public.ewaste_settlements
      add constraint ewaste_settlements_tx_org_fkey
      foreign key (transaction_id, organization_id)
      references public.ewaste_transactions(id, organization_id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_settlements_assay_org_fkey') then
    alter table public.ewaste_settlements
      add constraint ewaste_settlements_assay_org_fkey
      foreign key (assay_id, organization_id)
      references public.ewaste_assays(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_transaction_events_tx_org_fkey') then
    alter table public.ewaste_transaction_events
      add constraint ewaste_transaction_events_tx_org_fkey
      foreign key (transaction_id, organization_id)
      references public.ewaste_transactions(id, organization_id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ewaste_compliance_checks_tx_org_fkey') then
    alter table public.ewaste_compliance_checks
      add constraint ewaste_compliance_checks_tx_org_fkey
      foreign key (transaction_id, organization_id)
      references public.ewaste_transactions(id, organization_id)
      on delete cascade;
  end if;
end
$$;

comment on constraint ewaste_transactions_supplier_org_fkey on public.ewaste_transactions
  is 'Prevents cross-organization supplier linkage.';
comment on constraint ewaste_transactions_processor_org_fkey on public.ewaste_transactions
  is 'Prevents cross-organization processor linkage.';
comment on constraint ewaste_transaction_documents_tx_org_fkey on public.ewaste_transaction_documents
  is 'Keeps transaction evidence in the same organization as its transaction.';
