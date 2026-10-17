# Hermes Voice × Intelligent UI — Integration Gate

Status: DEVELOPMENT ONLY. This document does not assert that runtime voice integration is implemented.

## Existing repository capabilities
- Vite/React 18 + TypeScript
- @vapi-ai/web, @elevenlabs/react, @11labs/react
- three, @react-three/fiber, @xyflow/react, recharts
- pnpm validate:speech, typecheck, lint, test, test:e2e, security:scan

## Design
1. User explicitly activates microphone with browser permission.
2. Existing authenticated frontend opens an ephemeral, scoped voice session. No provider secret in VITE_* environment variables.
3. Voice adapter produces normalized intent and transcript events. Avoid simultaneous microphone ownership by multiple SDKs.
4. Backend verifies identity, session, tool permissions, rate limits and action-specific approval.
5. Hermes emits a typed UI event stream (AG-UI adapter only after compatibility validation).
6. Frontend renders an allowlisted set of components; do not execute model-authored arbitrary JavaScript.
7. TTS narrates grounded results, with cancel/interrupt controls and accessible transcript fallback.

## Proposed typed event contract
- voice.session.started {sessionId}
- voice.transcript.partial {sessionId,text}
- voice.transcript.final {sessionId,text}
- hermes.intent.proposed {sessionId,intentId,tool,arguments}
- hermes.action.approval_required {sessionId,intentId,summary}
- ui.component.proposed {sessionId,componentType,props,dataSource}
- voice.response.text {sessionId,text}
- voice.session.ended {sessionId,reason}

Never trust client-provided identity, tool names, UI props, or approvals without server validation.

## Release gates
- [ ] Inventory existing voice implementations and backend routes.
- [ ] Confirm CopilotKit/Open Intelligent UI version, license, React compatibility, and AG-UI API.
- [ ] Choose one microphone/session owner and add explicit opt-in UI.
- [ ] Add authenticated, scoped, short-lived voice session endpoint.
- [ ] Add backend intent schema and approved tool registry.
- [ ] Add UI renderer allowlist and safe fallback for unsupported components.
- [ ] Add spoken reply, interrupt, timeout, disconnect, and transcript fallback.
- [ ] Test denial of microphone access, expired session, unauthorized tool, prompt injection, reconnection, and two-account isolation.
- [ ] Run pnpm typecheck, pnpm lint, pnpm test, pnpm build, and relevant Playwright checks.
- [ ] Verify no provider credentials appear in client bundles or logs.
- [ ] Review staging screenshots and desktop/mobile voice QA.
- [ ] Obtain explicit release approval before merging or publishing.

## First demo
" Hermes, show my agent dashboard and explain which services need attention. "
Must use authenticated real service data or clearly labeled fixtures. No fabricated live metrics.

## Rollback
Feature flag off by default. Disable voice session issuance and hide the voice control without modifying the existing Hermes execution path.
