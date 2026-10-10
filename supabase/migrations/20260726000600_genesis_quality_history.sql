-- Preserve one release-gate snapshot per evaluation rather than overwriting the
-- previous run. The Quality Center can therefore reconstruct exact past evidence.

alter table public.genesis_release_gates
  drop constraint if exists genesis_release_gates_project_id_gate_key_key;

create unique index if not exists genesis_release_gates_evaluation_gate_idx
  on public.genesis_release_gates(evaluation_run_id, gate_key)
  where evaluation_run_id is not null;

create index if not exists genesis_release_gates_project_created_idx
  on public.genesis_release_gates(project_id, created_at desc);
