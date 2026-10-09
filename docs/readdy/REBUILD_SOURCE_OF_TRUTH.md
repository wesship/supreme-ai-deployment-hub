# D3VONN.IO Readdy reference — current source of truth

Status: historical visual reference; repository-native runtime authority.
Reviewed 2026-10-09 against main commit `321e8f39b73bbfd897a13dccd44ea1b7dcf408d2`.

## Current homepage authority

`AGENTS.md` and `src/App.tsx` are authoritative. The public homepage is
`src/pages/Index.tsx` → `src/pages/KnowledgeGraphOS.tsx`, the repository-native
Neural Nexus / Knowledge Graph experience. It owns its application chrome.
Readdy components, styles, previews, and older intake documents are visual
references; they do not establish the deployed frontend or backend behavior.

The earlier six-page rebuild plan below is superseded as an active homepage
replacement plan. The presentation allowlist in
`src/integrations/readdy/marketingSurfaces.ts` is an integration boundary,
not authorization to replace the current runtime shell.

## Reference-site handoff

A separate Readdy reference should send operational actions to the canonical
application rather than its generated preview routes. Use absolute links to
the verified deployment origin when crossing from the builder preview.

| Reference action | Repository route |
|---|---|
| Enter the Platform / Launch D3VONN | /app |
| Command Core / operational Infrastructure | /command-center |
| Operational AI Agents | /agents |
| Marketplace | /marketplace |
| Music Studio / Sound Lab | /music |
| Voice Studio | /voice-studio |
| AI Films | /ai-films |
| Resources (formerly Blog) | /resources |
| Pricing / About / Contact | /pricing /about /contact |
| Privacy / Terms | /privacy /terms |
| Admin OCC | /occ |

These routes are defined in `src/App.tsx`. Preserve its authentication and
admin guards. Local exploration anchors may remain local to the visual
reference. Static agent statuses and task samples must be labeled illustrative;
a link to Command Core is a navigation handoff, not evidence of a live data feed.
Keep the requested artwork, special effects, animations, and logo blending.

## Runtime connection evidence and limits

On 2026-10-09, a read-only GET to
`https://d3vonn.io/api/runtime/identity` returned HTTP 200 with repository
`wesship/supreme-ai-deployment-hub`, `ui_authority: repository`,
`contract_version: 1.0`, and the reviewed commit above.
`https://api.d3vonn.io/health` returned HTTP 200 and `status: ok`.
This proves the reported API identity and health at that time; it does not
certify the frontend bundle commit, signed-in task execution, voice processing,
cross-account isolation, or every provider.

The existing repository clients use authenticated Hermes commands at
`/api/voice/hermes/command` and lifecycle events at
`/api/hermes/events/stream`. Readdy must not duplicate those clients or receive
server-side secrets. Full execution verification remains a separate signed-in
release gate.

## Protected authorities

Keep FastAPI APIs, Supabase authentication/RLS, Hermes, MoneyHub, Security Ops,
admin authorization, AI Films, Voice Studio/ElevenLabs, OCC, application routes,
CI/security workflows, and Vercel/Railway configuration repository-native.
Do not connect bidirectional builder sync to overwrite the repository root.
Any future selective visual import must preserve routing, analytics, SEO,
accessibility, reduced-motion support, and existing design tokens.

## Historical plan

The original Phase 1 presentation plan covered `/`, `/solutions`,
`/ai-agents`, `/pricing`, `/about`, and `/resources`.
It remains useful as historical context only. It does not override the current
homepage instructions in `AGENTS.md`.
