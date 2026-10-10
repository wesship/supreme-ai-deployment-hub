# D3VONN.IO Agent Vault Security Model

## Purpose

The Agent Vault layer protects D3VONN.IO by separating agent execution from credential custody.

Hermes should orchestrate work. It should not be the permanent source of truth for sensitive provider credentials.

## Recommended model

```text
Hermes Agent
  -> vault/proxy request
  -> Agent Vault validates the agent identity
  -> Agent Vault injects the required provider credential
  -> Provider API receives the request
  -> Audit event is written
```

## Why this matters

This gives D3VONN.IO:

- centralized credential revocation
- cleaner audit logging
- reduced blast radius if one agent is compromised
- easier rotation of provider credentials
- stronger tenant separation later
- safer Telegram, Twilio, GitHub, and AI-provider automation

## Access rules

Use these rules for production:

1. Only the backend and Hermes should reach the vault on the private Docker network.
2. Public access to the vault hostname should be blocked or protected by Cloudflare Access.
3. Every agent should have an agent identity.
4. Every tool call should be logged.
5. Production values must live only in the VPS `.env`, Hostinger secret storage, GitHub environment secrets, or a dedicated secrets manager.
6. Never commit real credentials.

## Credential groups

Group credentials by operational domain:

| Group | Examples |
| --- | --- |
| AI providers | OpenRouter, OpenAI, Anthropic |
| Data layer | Supabase, Pinecone |
| Communications | Twilio, Telegram, Vapi |
| Code operations | GitHub |
| Monitoring | Sentry, Grafana, Prometheus exporters |

## Rotation policy

Suggested rotation schedule:

| Credential type | Rotation |
| --- | --- |
| AI provider keys | every 90 days |
| GitHub automation token | every 60 to 90 days |
| Twilio and Vapi keys | every 90 days |
| service-role database keys | immediately after any suspected exposure |
| JWT and encryption material | controlled rotation with downtime window |

## Immediate production requirement

Before connecting Hermes to real external actions, confirm:

```bash
bash deploy/vps/scripts/healthcheck.sh
```

Then verify:

```bash
docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env ps
```

Do not expose the vault publicly until access control is confirmed.
