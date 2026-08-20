# PRIMETIME governed schema reconciliation

The governed-intelligence increment must extend the canonical PRIMETIME schema rather than introduce a second workspace or authorization model.

## Canonical boundary

- Workspace table: `public.primetime_workspaces`
- Workspace membership: `public.primetime_workspace_memberships`
- RLS helper: `private.is_active_workspace_member(uuid)`
- Existing PRIMETIME lead domain: `public.primetime_leads`

The private helper resolves active membership through `auth.uid()` and is intentionally not exposed as a normal public RPC. See `20260811035000_private_workspace_membership_helper.sql`.

## Corrective action

The event-ledger migration was reconciled to the canonical workspace/RLS contract before staging. The initial draft referenced `public.workspaces` and `public.is_workspace_member`; those references were removed rather than introducing compatibility tables or duplicate authorization logic.

## Deployment gate

The ledger migration remains forward-only and explicitly marked for staging rehearsal before production execution. CI should validate migration ordering, static schema references, RLS policies, and immutable-ledger behavior before runtime enablement.
