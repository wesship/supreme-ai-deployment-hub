# Agent Vault Override Notes

The existing `deploy/vps/docker-compose.yml` already defines the main D3VONN production services, including Hermes.

Add Agent Vault as a private internal service before giving Hermes access to high-value external actions.

## Recommended Compose behavior

Agent Vault should:

- run only on the private Docker network
- expose no public port by default
- be reachable by Hermes over the internal service name
- write audit logs
- use server-only environment values from `deploy/vps/.env`

Hermes should:

- keep an agent identity
- use vault/proxy mode where supported
- avoid storing direct provider credentials long term
- log every external action request

## Safer routing

Do not expose `vault.d3vonn.io` publicly until Cloudflare Access, IP allowlisting, or another authentication layer is active.

Preferred access pattern:

```text
Hermes container -> private Docker network -> Agent Vault container -> external provider APIs
```

## Activation checklist

1. Fill `deploy/vps/.env` on the VPS.
2. Start base services.
3. Confirm backend and Redis health.
4. Add Agent Vault service to Compose.
5. Start Agent Vault privately.
6. Configure Hermes to call the internal vault URL.
7. Test one low-risk provider call.
8. Enable Telegram, Twilio, Vapi, GitHub, and AI-provider tools one by one.

## Important

Do not commit real values. Keep the committed example file as placeholders only.
