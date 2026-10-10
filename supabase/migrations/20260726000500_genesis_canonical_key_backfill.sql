-- Backfill project canonical keys through the owner-scoping trigger before any
-- downstream project creates canon or agent identities.

update public.genesis_projects
set canonical_key = canonical_key,
    updated_at = now();

-- All canonical project keys should now end in the first eight owner UUID hex digits.
do $$
begin
  if exists (
    select 1
    from public.genesis_projects p
    where right(p.canonical_key, 9) <> (
      '.' || upper(substr(replace(p.owner_id::text, '-', ''), 1, 8))
    )
  ) then
    raise exception 'genesis_project_canonical_key_backfill_failed';
  end if;
end;
$$;
