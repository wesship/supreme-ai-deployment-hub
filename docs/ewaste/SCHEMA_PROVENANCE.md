# E-Waste OS schema provenance

## Production state verified 2026-09-04

The active Supabase production project already contains the Kwame Fuze / D3VONN Ghana E-Waste OS v1 schema. The production migration ledger records these historical migrations:

- `20260821221603_kwame_fuze_ewaste_os_v1`
- `20260821221618_kwame_fuze_ewaste_os_v1_security_hardening`
- `20260821221630_kwame_fuze_ewaste_os_private_rls_helper`

These versions were applied directly to production before the migration SQL was present on the repository's current `main` branch. Do not add the obsolete PR #996 file `20260821160000_kwame_fuze_ewaste_os_v1.sql` to `supabase/migrations`; that version is not in the production migration ledger and could be treated as a new migration.

Production verification confirms:

- 14 `public.ewaste_*` tables are present.
- RLS is enabled on all 14 tables.
- Each table has two organization-scoped policies.
- Policies use `private.ewaste_is_member(...)`.
- The private helper is `SECURITY DEFINER`, pins `search_path = public`, and is not directly executable by `anon`, `authenticated`, or `service_role`.
- `public.ewaste_set_updated_at()` is `SECURITY INVOKER` with pinned `search_path = public`.
- `public.ewaste_transaction_margin_view` is security-invoker hardened by the historical hardening migration.

## Data-integrity finding

The original schema used single-column foreign keys together with a separate `organization_id`. That allowed the database to accept a cross-organization reference if application/RLS safeguards were bypassed or a privileged backend wrote inconsistent UUIDs.

A production read-only integrity scan on 2026-09-04 found zero existing cross-organization mismatches across transaction/supplier/material/processor, documents, transport, intake, assay, settlement, event, and compliance relationships.

The forward migration `20260904235324_kwame_fuze_ewaste_org_integrity_hardening.sql` adds composite `(id, organization_id)` reference enforcement. It was applied and verified on staging first. Production must receive it only through the protected migration workflow after PR CI and `D3VONN Required PR Gate` pass.

## Operating boundary

This schema is a data/control foundation only. It does not grant or imply Ghana EPA authorization, licensing, waste classification, transport authority, processor approval, insurance coverage, banking approval, or permission to begin commercial e-waste operations. Those remain external compliance gates.
