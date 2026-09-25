# HNFPORTAL.one ↔ D3VONN.IO Hermes Bridge v1

HNF surfaces use D3VONN.IO Hermes as their shared orchestration/control plane.
The browser never receives Hermes credentials. HNFPORTAL server-side code calls
the bridge using REST or MCP; Telegram is an allowlisted operator transport.

## REST

`POST /api/hnf/v1/workflows/{workflow}`

Headers:

```
X-HNF-Service-Key: <server-side secret>
Content-Type: application/json
```

Example:

```json
{
  "request_id": "radio-break-20260925-0001",
  "actor_id": "hnf-radio-scheduler",
  "actor_type": "service",
  "persona_id": "hnf-dj-001",
  "budget_max_usd": 0.25,
  "context": {
    "previous_track": "track-a",
    "next_track": "track-b",
    "duration_target_seconds": 18
  }
}
```

Requests become ordinary Hermes tasks with:
- `agent_name=HERMES`
- `source=hnfportal:<transport>`
- `task_type=<HNF workflow name>`
- `correlation_id=hnfportal:<request_id>`

The correlation ID makes client retries idempotent.

## MCP

`POST /api/hnf/v1/mcp`

Supported JSON-RPC methods:
- `tools/list`
- `tools/call`

Every allowlisted HNF workflow is exposed as an MCP tool. The same
`X-HNF-Service-Key` is required, so MCP does not bypass the gateway.

## Telegram

Configure a Telegram bot webhook to:

`POST /api/hnf/v1/telegram/webhook`

Hermes verifies Telegram's `X-Telegram-Bot-Api-Secret-Token` and rejects any
chat ID not listed in `HNF_TELEGRAM_ALLOWED_CHAT_IDS`.

Command:

```
/hnf run hnf.radio.dj.generate Play a short station break before the next track
```

Telegram is an operator/HITL transport, not a substitute for application APIs.

## Required environment

```
HNF_HERMES_API_KEY=<random high-entropy server-side secret>
HNF_TELEGRAM_WEBHOOK_SECRET=<random Telegram webhook secret>
HNF_TELEGRAM_ALLOWED_CHAT_IDS=<comma-separated operator chat ids>
```

Do not expose these values through `VITE_*`, frontend bundles, or public HNF
JavaScript.

## Surfaces

v1 allowlists RADIO, TV, Academy, Store/Brand, Lyrics, Media, Creator, Support,
Marketing, Analytics, and Admin workflows. New workflows should be added to
`backend/hnf/registry.py` rather than accepting arbitrary task names.

## Persona model

Personas are registry records, not separate orchestration systems. Current
starter personas include DJ, teacher, instructor, TV host, chef, and support.
Voice/video providers remain adapters selected downstream by Hermes.

## Production gate

1. Add the service secret(s) to Railway.
2. Add the same HNF service key to the HNFPORTAL server environment.
3. Configure HNFPORTAL to call `https://api.d3vonn.io/api/hnf/v1`.
4. Register the Telegram webhook only after the chat allowlist is populated.
5. Run backend tests and a staging smoke test.
6. Confirm approval-required workflows create/route through the normal Hermes
   approval/interrupt policy before enabling destructive or publish actions.
