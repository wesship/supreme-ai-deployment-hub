-- Cover the final public-schema foreign key reported by the database advisor.
begin;

do $genesis_release_gates$
begin
  if to_regclass('public.genesis_release_gates') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'genesis_release_gates'
         and column_name = 'evaluation_run_id'
     ) then
    execute 'create index if not exists genesis_release_gates_evaluation_run_id_fk_idx
      on public.genesis_release_gates(evaluation_run_id)';
  end if;
end
$genesis_release_gates$;

commit;
