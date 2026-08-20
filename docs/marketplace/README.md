# D3VONN.IO Marketplace hardening

This directory documents the production Marketplace contract.

## Canonical model

The Marketplace catalog is currently backed by `agent_templates`, while user installations are backed by `deployed_agents`. The hardening work keeps those concepts separate and treats installation as a governed lifecycle rather than a client-side status update.

## Security boundary

- Public users may read published catalog entries.
- Authenticated users may create installation requests for published templates.
- Installation records are owned by the creating user.
- Runtime status, health, metrics, and lifecycle transitions are server-controlled.
- Publisher review state is not client-controlled.
- MCP tool access is treated as requested capability metadata and must not be interpreted as an authorization grant by the browser.

## Closeout gates

1. Catalog is discoverable.
2. Listing metadata is explicit.
3. Installation requires authentication.
4. Installation is recorded transactionally.
5. Lifecycle state is constrained in the database.
6. Client cannot directly mutate runtime-controlled fields.
7. Audit evidence exists for Marketplace installation changes.
8. Production route and deployment are verified after release.
