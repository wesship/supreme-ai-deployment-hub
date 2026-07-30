-- Cover the final public-schema foreign key reported by the database advisor.
begin;

create index if not exists genesis_release_gates_evaluation_run_id_fk_idx
  on public.genesis_release_gates(evaluation_run_id);

commit;
