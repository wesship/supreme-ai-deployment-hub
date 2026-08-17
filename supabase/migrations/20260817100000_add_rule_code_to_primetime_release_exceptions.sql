-- Add missing rule_code column to primetime_release_exceptions.
-- The backend router (primetime_release1.py) queries this column for the
-- Release 1 CRM dashboard exceptions panel. Without it, the dashboard
-- returns a 400 error: "column primetime_release_exceptions.rule_code does not exist".
begin;

alter table public.primetime_release_exceptions
  add column if not exists rule_code text not null default 'GENERAL';

comment on column public.primetime_release_exceptions.rule_code is
  'Machine-readable exception classification code (e.g. MISSING_NEXT_ACTION, STALE_LEAD, DUPLICATE_CONTACT).';

-- Backfill existing rows: derive rule_code from exception_type where possible.
update public.primetime_release_exceptions
  set rule_code = upper(replace(exception_type, ' ', '_'))
  where rule_code = 'GENERAL' and exception_type is not null;

commit;
