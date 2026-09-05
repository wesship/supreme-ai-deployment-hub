# Marketplace Installation Authority

Status: staging implementation; production mutation cutover blocked.

## Current authority model

- `public.agent_registry` is the only canonical marketplace catalog.
- Public discovery is exposed through the FastAPI marketplace adapter.
- `POST /api/marketplace/installations` validates the Supabase user with the existing backend auth dependency.
- The server resolves the requested agent against `agent_registry` and owns `user_id`, canonical `template_id`, and initial `status=starting`.
- Client-supplied runtime fields are rejected by the request model.
- The service role remains server-side only.

## Audit model

`public.marketplace_installation_events` is append-only in staging:

- authenticated: SELECT only, restricted by RLS to `actor_id = auth.uid()`
- service_role: SELECT + INSERT only
- anon: no table privileges
- UPDATE and DELETE are blocked by database triggers
- legacy marketplace mutation SECURITY DEFINER RPCs are removed from staging

## Failure semantics

An installation is not accepted as successful unless its audit event is appended. If audit append fails after row creation, the backend attempts a compensating deletion of the newly created installation and returns the audit failure.

## Production cutover gate

Do not revoke the existing authenticated `deployed_agents` INSERT/UPDATE/DELETE path until all of the following are complete:

1. Backend tests and required CI are green.
2. Staging endpoint is exercised with a real authenticated test user.
3. Existing deployed-agent rows are checked for compatibility.
4. OpenMontage/Film lookup behavior is verified.
5. Frontend deployment calls are moved from direct Supabase mutation to the FastAPI endpoint.
6. Start/stop/uninstall lifecycle endpoints use explicit server-owned transition rules and append audit events.
7. Rollback instructions are tested.
8. Production migration is promoted only through the protected workflow.

This work does not authorize runtime execution merely by installing an agent; execution remains subject to the existing D3VONN capability, approval, and runtime controls.