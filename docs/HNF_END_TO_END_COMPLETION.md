# HNFPORTAL.one ↔ D3VONN.IO Hermes — End-to-End Completion Gates

## Completed in code

### Gate 1 — Shared Hermes intake
HNF requests use the existing Hermes task engine, persistence, event logging,
worker leases, correlation IDs, and orchestrator. No second queue is introduced.

### Gate 2 — Multi-transport bridge
REST, MCP JSON-RPC, and Telegram converge on the same allowlisted HNF registry.

### Gate 3 — Fail-closed protected actions
Approval-required HNF workflows are created directly in `PAUSED` state, so a
worker cannot claim them before human approval.

Approval-required v1 workflows:
- `hnf.radio.broadcast.publish`
- `hnf.support.escalate`
- `hnf.admin.operation`

### Gate 4 — Approval/rejection
Server-to-server:
- `POST /api/hnf/v1/requests/{request_id}/decision`

Telegram:
- `/hnf approve <request_id> [note]`
- `/hnf reject <request_id> [note]`

An approved task transitions atomically from `PAUSED` to `PENDING`.
A rejected task transitions atomically from `PAUSED` to `CANCELLED`.

### Gate 5 — Status
- `GET /api/hnf/v1/requests/{request_id}`

HNF surfaces should classify:
- `PENDING | LOCKED | RUNNING`: active
- `PAUSED`: awaiting approval
- `COMPLETED`: result available
- `FAILED | CANCELLED`: terminal failure/rejection

### Gate 6 — Portable HNF server SDK
`sdk/hnf-hermes-client.ts` is the canonical server-side client.
`sdk/hnf-hermes-edge-proxy.example.ts` is the safe browser-to-server proxy
pattern for HNFPORTAL/Lovable/Supabase.

## Production activation gates

### D3VONN / Railway
Configure:
```
HNF_HERMES_API_KEY=<high-entropy-secret>
HNF_TELEGRAM_WEBHOOK_SECRET=<telegram-webhook-secret>
HNF_TELEGRAM_ALLOWED_CHAT_IDS=<operator-chat-ids>
```

Existing Hermes/Supabase/worker variables must remain valid.

### HNFPORTAL server environment
Configure the same `HNF_HERMES_API_KEY` only in the server/edge environment.
Never expose it through browser environment variables.

### Telegram
Set the Telegram webhook to:
```
https://api.d3vonn.io/api/hnf/v1/telegram/webhook
```

Use Telegram's webhook secret-token header and populate the chat allowlist
before activation.

## First certified E2E path: HNF RADIO DJ

1. HNF RADIO creates a stable request ID.
2. Server proxy calls `hnf.radio.dj.generate` with persona `hnf-dj-001`.
3. Hermes persists the task and emits `hnf.workflow.accepted`.
4. Hermes worker atomically claims the task.
5. HERMES routes the task through its configured execution adapters.
6. HNF RADIO polls the request status.
7. When `COMPLETED`, HNF RADIO consumes the structured task output.
8. Voice generation/broadcast publication remains a separate downstream step.
9. `hnf.radio.broadcast.publish` is fail-closed in `PAUSED`.
10. An HNF admin or allowlisted Telegram operator approves it.
11. Only then can the worker claim and execute the publish task.

Do not fabricate audio or a successful broadcast when a provider is unavailable.
Expose the real Hermes/provider state.

## HNF surface mapping

- RADIO: DJ generation/speech/schedule/intro/publish
- TV: schedule/playout/metadata/health/clips
- Academy: lessons/instructors/quizzes/student assist
- Store/Brand: enrichment/mockups/inventory/order assist
- Lyrics: ingest/annotation/QR
- Media: transcode/caption/thumbnail/archive
- Creator: publishing packages
- Support: answer/ticket/escalation
- Marketing: campaign generation
- Analytics: reports
- Admin: protected administrative operations

## Remaining external activation dependencies

1. Merge and deploy the D3VONN PR after CI is green.
2. Add the HNF secret(s) to Railway.
3. Apply the SDK/proxy to the live HNFPORTAL frontend/server project.
4. Run staging smoke tests against `/health`, workflow submission, polling,
   protected approval, rejection, duplicate request retry, and MCP `tools/list`.
5. Certify the RADIO DJ flow before enabling broadcast publishing.
