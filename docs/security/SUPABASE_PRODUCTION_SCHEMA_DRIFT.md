# Supabase Production Schema Drift

Issue: #507

## Captured production-only tables

The append-only migration `20260723001500_capture_production_schema_drift.sql` reproduces the production schemas, constraints, indexes, grants, and RLS boundaries for:

- `approval_requests`
- `rag_document_logs`
- `approval_queue`
- `rag_documents`

## Disposition

`approval_queue` and `rag_documents` remain active application tables. Authenticated users retain only owner-scoped `SELECT` and `INSERT`; administrators are authorized through `auth.jwt()->'app_metadata'->>'role'`; `service_role` retains full backend access.

`approval_requests` and `rag_document_logs` are legacy, currently unused, and retained temporarily to avoid an irreversible production deletion. They are classified as backend-only: browser grants are revoked and explicit deny policies cover `anon` and `authenticated`. Removal requires a separate usage audit and production approval.

## Validation requirements

Before production promotion:

1. Apply the migration to a fresh isolated Supabase branch.
2. Confirm all four tables, constraints, and indexes exist.
3. Confirm anonymous access is denied on all four tables.
4. Confirm an ordinary authenticated user can insert and read only their own active-table records.
5. Confirm cross-user reads are denied.
6. Confirm an `app_metadata.role=admin` user can manage active-table records.
7. Confirm `service_role` has full CRUD access.
8. Run Supabase Security and Performance Advisors.

Production promotion is intentionally excluded from this change and requires explicit approval.
