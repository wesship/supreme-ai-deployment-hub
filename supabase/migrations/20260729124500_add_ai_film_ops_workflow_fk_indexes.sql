-- Add only missing leading-column indexes for the task's AI Film, Operations, and workflow foreign keys.
begin;

do $$
declare
  foreign_key record;
  index_name text;
  column_list text;
begin
  for foreign_key in
    select
      constraint_row.conname,
      constraint_row.conrelid,
      constraint_row.conkey,
      namespace_row.nspname as schema_name,
      relation_row.relname as table_name
    from pg_constraint constraint_row
    join pg_class relation_row on relation_row.oid = constraint_row.conrelid
    join pg_namespace namespace_row on namespace_row.oid = relation_row.relnamespace
    where constraint_row.contype = 'f'
      and namespace_row.nspname = 'public'
      and (
        relation_row.relname like 'ai_film%'
        or relation_row.relname like 'ops_%'
        or relation_row.relname in (
          'workflows',
          'workflow_runs',
          'agent_activity_logs',
          'ai_request_logs',
          'approval_queue',
          'error_logs',
          'rag_documents',
          'tool_call_logs',
          'user_plans'
        )
      )
      and not exists (
        select 1
        from pg_index index_row
        where index_row.indrelid = constraint_row.conrelid
          and index_row.indisvalid
          and index_row.indisready
          and index_row.indpred is null
          and (
            select bool_and(
              (index_row.indkey::smallint[])[key_column.ordinality - 1] = key_column.attnum
            )
            from unnest(constraint_row.conkey) with ordinality
              as key_column(attnum, ordinality)
          )
      )
    order by relation_row.relname, constraint_row.conname
  loop
    select string_agg(format('%I', attribute_row.attname), ', ' order by key_column.ordinality)
      into column_list
    from unnest(foreign_key.conkey) with ordinality
      as key_column(attnum, ordinality)
    join pg_attribute attribute_row
      on attribute_row.attrelid = foreign_key.conrelid
     and attribute_row.attnum = key_column.attnum;

    index_name := left(
      foreign_key.table_name || '_' || foreign_key.conname || '_idx',
      55
    ) || '_' || substr(md5(foreign_key.conname), 1, 7);

    execute format(
      'create index if not exists %I on %I.%I (%s)',
      index_name,
      foreign_key.schema_name,
      foreign_key.table_name,
      column_list
    );
  end loop;
end
$$;

commit;
