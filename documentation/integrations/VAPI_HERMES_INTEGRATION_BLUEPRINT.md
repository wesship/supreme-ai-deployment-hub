# Vapi ↔ Hermes Integration Blueprint

> Living document. Owner: D3VONN platform team. Status: draft v0.1.

## 1. Purpose

Evolve Vapi from a voice-chat surface into an **autonomous conversational
operations layer** for D3VONN, orchestrated by Hermes and grounded in
the existing agent mesh, MCP servers, n8n workflows, and Supabase RLS data
plane.

## 2. High-level architecture

```text
 Caller (PSTN / Web SDK)
        │
        ▼
   Vapi Assistant ──► webhook ──► Supabase Edge Fn: hermes-voice-adapter
        ▲                                   │
        │ TTS stream                        ▼
        │                          Hermes Orchestrator (FastAPI)
        │                                   │
        │            ┌──────────┬───────────┼───────────┬──────────┐
        │            ▼          ▼           ▼           ▼          ▼
        │      Research   CRM Agent   Scheduling   Compliance   Sales
        │       Agent                  Agent        Agent       Closer
        │            └──────────┴───────────┬───────────┴──────────┘
        │                                   ▼
        │                          Tool Mesh (MCP / n8n / REST)
        │                                   │
        └────── synthesized response ◄──────┘
```

## 3. Capability stack

| # | Layer | Capability | Stores / services |
|---|---|---|---|
| 1 | Voice surface | Vapi Web SDK + PSTN | `@vapi-ai/web` |
| 2 | Adapter | `hermes-voice-adapter` edge fn | Supabase Edge Functions |
| 3 | Orchestrator | Hermes ReAct + swarm dispatch | FastAPI `api.d3vonn.io` |
| 4 | Memory fabric | Transcript → embeddings → graph | pgvector + Neo4j |
| 5 | Tool mesh | MCP gateway, n8n, direct REST | `mcp_connections`, n8n |
| 6 | RAG | Voice-time knowledge retrieval | pgvector, Qdrant |
| 7 | Sentiment | Real-time emotion/intent stream | Deepgram / Hume |
| 8 | Governance | Constitutional + policy gates | OPA (hermes/v3) |
| 9 | Observability | Tokens, latency, drift, hallucination | Langfuse, OTEL |
| 10 | Supervisor UI | Live transcript + intervention | AG-UI, /jarvis |
| 11 | Campaigns | Outbound trigger → Vapi call | n8n + CRM |
| 12 | Edge / IoT | MQTT / Node-RED bridge | OhO glasses, Jetson |

## 4. Data model (new tables)

All RLS-protected (`auth.uid() = user_id`).

- `voice_sessions` — call id, vapi_call_id, started_at, ended_at, status, summary
- `voice_turns` — session_id, role, text, audio_url, sentiment, latency_ms
- `voice_memory` — session_id, embedding `vector(3072)`, importance, decay_at
- `voice_tool_calls` — session_id, agent, tool, input, output, approved_by
- `voice_campaigns` — owner, script_id, trigger, schedule, status

Safe views (`security_invoker = on`) expose non-sensitive columns to clients.

## 5. Edge functions

| Function | Verb | Purpose |
|---|---|---|
| `hermes-voice-adapter` | POST | Vapi webhook → Hermes; streams tool results back |
| `vapi-session-init` | POST | Mint Vapi public key + ephemeral session for Web SDK |
| `voice-memory-embed` | POST | Chunk + embed transcript via Lovable AI Gateway |
| `voice-memory-search` | POST | Cosine + graph rerank for RAG |
| `voice-campaign-trigger` | POST | CRM/n8n hook → schedule outbound call |
| `voice-supervisor-stream` | GET (SSE) | Live transcript + intervention channel |

All use **user JWT** for RLS (per project rule). Zod validation on every body.

## 6. Phased rollout

### Phase 0 — Foundation (this PR)
- This blueprint doc
- `voice_sessions` + `voice_turns` migration
- `vapi-session-init` edge function stub
- `/voice` React page (Web SDK mount, status HUD)

### Phase 1 — Orchestrated calls
- `hermes-voice-adapter` webhook
- Hermes intent → agent swarm dispatch
- Transcript persistence + summary on call end

### Phase 2 — Memory + RAG
- `voice_memory` table + embedding pipeline
- `voice-memory-search` with decay weighting

### Phase 3 — Governance + observability
- OPA policy gates on tool calls
- Langfuse spans; hallucination + drift dashboard
- Supervisor live-intervention console (AG-UI)

### Phase 4 — Autonomous campaigns + multimodal
- Outbound trigger from CRM via n8n
- Browser/computer-use + vision tools through MCP
- IoT bridge via MQTT (Node-RED) for edge actions

## 7. Secrets required

| Secret | Used by |
|---|---|
| `VAPI_PUBLIC_KEY` | Web SDK (publishable, may live in code) |
| `VAPI_PRIVATE_KEY` | `vapi-session-init`, server-side ops |
| `VAPI_WEBHOOK_SECRET` | `hermes-voice-adapter` HMAC verify |
| `LOVABLE_API_KEY` | embeddings + LLM (already present) |

## 8. Repo layout (added by this work stream)

```
docs/integrations/VAPI_HERMES_INTEGRATION_BLUEPRINT.md   ← this file
supabase/functions/vapi-session-init/index.ts
supabase/functions/hermes-voice-adapter/index.ts
supabase/functions/voice-memory-embed/index.ts
supabase/functions/voice-memory-search/index.ts
src/pages/Voice.tsx
src/lib/voice/vapiClient.ts
src/lib/voice/hermesBridge.ts
```

## 9. Vendor abstraction

A thin `VoiceProvider` interface lets us swap Vapi for Retell / LiveKit /
Twilio Voice without touching Hermes:

```ts
interface VoiceProvider {
  startSession(opts: SessionOpts): Promise<SessionHandle>;
  endSession(id: string): Promise<void>;
  onTranscript(cb: (turn: Turn) => void): Unsubscribe;
  speak(text: string, voice?: string): Promise<void>;
}
```

## 10. Open questions

- Inbound PSTN routing — own number on Vapi vs. Twilio SIP trunk into Vapi?
- Memory decay policy — exponential half-life vs. importance-weighted?
- Constitutional layer — embed OPA in adapter, or call hermes/v3 firewall?
- Multi-tenant billing — meter per `voice_sessions.id` or per minute?

---

# Vapi–Hermes Compliance Gate

**Status:** Pre-activation checklist — Vapi integration must NOT move from “parked” to “active” until every item below is implemented and verified with live evidence (logs, screenshots, recordings).

**Why this exists:** AI-generated voice calls are regulated under TCPA/FCC rules (prerecorded/artificial voice), FTC telemarketing rules, and Colorado AI-disclosure + insurance-specific requirements. Hermes must not be permitted to trigger outbound Vapi calls in an insurance context until these controls are live.

## 1. Consent Gate (blocks outbound dialing)

- [ ] Every lead record has a `consent_status` field (`granted` / `none` / `revoked`) with timestamp and source of consent
- [ ] Hermes dispatch logic checks `consent_status == granted` before queuing any outbound Vapi call for marketing/insurance purposes
- [ ] A purchased lead list alone does NOT set `consent_status = granted` — must be explicit, documented consumer opt-in
- [ ] Inbound (consumer-initiated) calls bypass this gate; outbound does not
- [ ] Unit/integration test: Hermes refuses to dispatch a call when `consent_status != granted`

## 2. DNC Scrubbing

- [ ] Outbound number list is checked against the National Do Not Call Registry before dispatch
- [ ] Internal company-specific do-not-call list is maintained and checked
- [ ] Scrub step runs as part of the Hermes pre-dispatch pipeline, not as a manual/offline step
- [ ] Scrub results are logged (number checked, result, timestamp)

## 3. Call Hours Enforcement

- [ ] Hermes computes recipient local time before dispatch (not server/operator time)
- [ ] Calls blocked outside permitted hours (generally 8am–9pm recipient local time)
- [ ] Blocked-call attempts are logged with reason

## 4. AI Disclosure (Vapi assistant config)

- [ ] Vapi assistant’s first utterance includes AI disclosure, e.g.:

> “Hello, I’m an automated AI assistant working on behalf of Wesley Little and his agency. I can provide general information and help schedule an appointment. I am not a licensed insurance producer, and I cannot recommend, approve, or bind insurance coverage.”

- [ ] Disclosure is present in both inbound and outbound assistant configs
- [ ] Disclosure text is version-controlled in the blueprint repo, not only in the Vapi dashboard

## 5. Scope Restrictions (assistant prompt/tools)

- [ ] Assistant prompt explicitly forbids: policy recommendations, coverage interpretation, negotiating/binding coverage, completing/signing applications, underwriting/pricing/approval statements, promising returns/coverage/approval
- [ ] Assistant is restricted to: info collection, scheduling, FAQ (approved list), escalation to licensed human
- [ ] Escalation path defined: under what conditions does the assistant transfer/flag to a human producer

## 6. Opt-Out Handling

- [ ] Vapi call flow includes a working opt-out mechanism (verbal or DTMF)
- [ ] Opt-out triggers immediate `consent_status = revoked` update in the lead record
- [ ] Revoked numbers are excluded from future Hermes dispatch (re-check against #1)

## 7. Audit Logging

- [ ] Every Hermes-triggered Vapi call logs: timestamp, recipient number (or hashed ID), consent basis, DNC scrub result, call-hours check result, assistant config version, call recording/transcript reference, outcome
- [ ] Logs are retained per data-retention policy and accessible for compliance review

## 8. End-to-End Smoke Test (before activation)

- [ ] Proxy routes verified live (not just deployed)
- [ ] Vapi credentials/webhook secret confirmed working (`VAPI_WEBHOOK_SECRET` in Supabase tested against real webhook event)
- [ ] Phone number provisioned and confirmed receiving/placing calls
- [ ] One full inbound call tested end-to-end (disclosure plays, scope respected, transcript logged)
- [ ] One full outbound call tested end-to-end with a consented test number (consent gate, DNC scrub, hours check, disclosure, opt-out, logging all verified in sequence)
- [ ] Results captured as proof artifacts (curl output, logs, recordings) per existing gate-discipline standard (no green without live proof)

## Activation Sign-off

Vapi integration may move from “parked” to “active” only when all checkboxes above are complete and proof artifacts are attached to the corresponding PR.
