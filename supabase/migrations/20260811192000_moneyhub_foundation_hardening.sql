-- MoneyHub foundation hardening
-- Clarifies reversal semantics, corrects the derived balance view, and closes helper-function privileges.

begin;

-- Reversals are represented as separate posted journals with opposite entries.
-- The original immutable journal is never transitioned to a different status.
alter table public.moneyhub_journals
  drop constraint if exists moneyhub_journals_status_check;
alter table public.moneyhub_journals
  add constraint moneyhub_journals_status_check check (status = 'posted');

alter table public.moneyhub_journals
  drop column if exists reversed_journal_id;

-- Only include entries whose journal successfully joins as a posted journal.
-- This remains defensive even though this release permits only posted journals.
create or replace view public.moneyhub_account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.owner_id,
  a.code,
  a.name,
  a.account_type,
  a.normal_balance,
  a.currency,
  a.agent_name,
  coalesce(sum(
    case
      when j.id is null then 0
      when e.direction = a.normal_balance then e.amount
      else -e.amount
    end
  ), 0)::numeric(24,8) as balance
from public.moneyhub_accounts a
left join public.moneyhub_entries e on e.account_id = a.id
left join public.moneyhub_journals j on j.id = e.journal_id and j.status = 'posted'
group by a.id, a.owner_id, a.code, a.name, a.account_type,
         a.normal_balance, a.currency, a.agent_name;

revoke all on public.moneyhub_account_balances from anon, authenticated;
grant select on public.moneyhub_account_balances to authenticated;
grant select on public.moneyhub_account_balances to service_role;

-- Trigger helpers are internal implementation details and should not expand the RPC surface.
revoke execute on function public.moneyhub_set_updated_at() from public, anon, authenticated;
revoke execute on function public.moneyhub_prevent_posted_mutation() from public, anon, authenticated;

-- Make the ownership correlation explicit in the entry read policy.
drop policy if exists moneyhub_entries_owner_read on public.moneyhub_entries;
create policy moneyhub_entries_owner_read
  on public.moneyhub_entries for select to authenticated
  using (exists (
    select 1
    from public.moneyhub_journals j
    where j.id = moneyhub_entries.journal_id
      and j.owner_id = (select auth.uid())
  ));

commit;
