-- Cover the remaining Secrets Vault foreign keys reported by the database advisor.
begin;

create index if not exists secret_inventory_created_by_fk_idx
  on public.secret_inventory(created_by);
create index if not exists secret_inventory_updated_by_fk_idx
  on public.secret_inventory(updated_by);
create index if not exists secret_inventory_audit_actor_id_fk_idx
  on public.secret_inventory_audit(actor_id);

commit;
