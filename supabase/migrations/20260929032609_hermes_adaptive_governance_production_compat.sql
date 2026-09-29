-- Production compatibility marker for Hermes adaptive governance.
-- The live project required the adaptive governance tables/functions after the
-- canonical Hermes task schema had already moved to task_type/source defaults
-- and no longer carried a per-task user_id column.
--
-- The substantive definitions live in the three immediately preceding
-- Hermes adaptive governance migrations. Those migrations are idempotent and
-- production-compatible; this marker preserves parity with the production
-- migration history version applied on 2026-09-29.
select 1;
