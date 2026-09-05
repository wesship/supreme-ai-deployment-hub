-- Gate 2-R: reconcile live staging drift with the canonical Hermes runtime contract.
-- Voice/runtime correlation IDs are opaque strings, not guaranteed UUIDs.

begin;

alter table public.hermes_logs
  alter column correlation_id type text
  using correlation_id::text;

commit;
