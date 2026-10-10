# Kernel Gateway VPS Activation Runbook

The persistent IPython kernel gateway is deployed independently from the existing D3VONN backend VPS compose stack. This prevents n8n/kernel changes from disturbing the currently running backend, Hermes, Redis, or Nginx services.

## Phase 1 — gateway validation

Run the GitHub Actions workflow `Kernel Gateway VPS Activation` with `mode=validate`.

This mode:

- verifies the existing VPS SSH secrets are present
- synchronizes the VPS checkout to current `main`
- creates `kernel-gateway/.env.production` from the committed example when missing
- generates `KERNEL_GATEWAY_API_TOKEN` locally on the VPS when missing or placeholder-valued
- preserves an existing real token
- validates the optional compose profile
- builds only the `python-kernel-gateway` image
- does not start or restart the gateway or any n8n service

No kernel credential is copied back into GitHub logs.

## Phase 2 — gateway activation

Run the same workflow with `mode=deploy` only after validation is green.

Deploy mode additionally:

- starts only `python-kernel-gateway`
- waits for its internal health endpoint
- runs `deploy/vps/scripts/smoke-kernel-gateway.sh`
- verifies TCP port 8000 has no host publication

The smoke test proves:

1. internal health is available
2. missing gateway authentication returns HTTP 401
3. an authenticated session can be created
4. an invalid per-session capability returns HTTP 403
5. Python state can be loaded into RAM
6. a later execution in the same kernel can reuse that state
7. session destruction works and subsequent execution returns HTTP 404

The smoke session and capability token are ephemeral and are cleaned up on both success and failure paths.

## Phase 3 — n8n activation

Do not activate n8n from the kernel profile until a pinned n8n image has been selected and its production Postgres, Redis queue, encryption key, and webhook configuration have been provisioned.

When n8n is enabled, each workflow execution should use this lifecycle:

1. create a kernel session keyed to the workflow execution ID
2. preserve the returned session capability token without logging it
3. load trusted computation state
4. run subsequent trusted Python steps against the same kernel
5. destroy the session in both success and error/finalization paths

The idle-session sweeper is a backstop, not the primary cleanup mechanism.

## Security boundary

The gateway is an authenticated persistent-computation service, not a hostile-code sandbox. Raw untrusted model or user text must not be executed directly as Python. Hostile or multi-tenant execution belongs in disposable per-execution containers or microVMs with outbound network policy.

## Rollback

If the gateway fails after activation, stop only the optional gateway service:

```bash
cd /opt/supreme-ai-deployment-hub
export N8N_IMAGE=unused
sudo -E docker compose \
  --env-file kernel-gateway/.env.production \
  -f docker-compose.kernel-gateway.yml \
  stop python-kernel-gateway
```

This does not modify or restart the main `deploy/vps/docker-compose.yml` stack.
