# D3VONN.IO Enterprise Experience v2

This is the execution plan for turning the public D3VONN.IO site from a strong landing page into a flagship AI operating system experience.

## Objective

Make the homepage and public product tour prove the platform visually and operationally:

- live public telemetry
- interactive knowledge graph
- Hermes orchestration demo
- AI workforce command surface
- marketplace catalog
- AI Movie Studio preview
- security and trust center
- performance and accessibility hardening

## Phase 1 — Public telemetry

Current backend already exposes a public stats router at `/api/public/stats` and `/api/public/health`.

Homepage should consume `/api/public/stats` only. It should not call admin or OCC-only endpoints directly.

Public response should stay non-sensitive and include:

- active agents
- completed workflows
- uptime percent
- pending queue count
- total processed tasks
- latest public-safe events
- system health
- cached status

Acceptance criteria:

- homepage fetches `/api/public/stats`
- no admin-only endpoint is called by unauthenticated public UI
- graceful fallback remains available when backend is offline
- no secrets or internal IDs are rendered

## Phase 2 — Interactive knowledge graph

Add a visual graph section that explains D3VONN as a connected operating system.

Nodes:

- User Intent
- Hermes Orchestrator
- AI Workforce
- Knowledge Graph
- Memory + RAG
- Workflow Engine
- Marketplace
- SOC / Security
- AI Movie Studio
- Analytics

Acceptance criteria:

- graph is visible on desktop
- lightweight simplified graph is visible on mobile
- every major node links to the matching product surface
- graph data is static at first, then upgraded to live platform data

## Phase 3 — Hermes Command Center demo

Add a guided visual simulation showing how Hermes decomposes a goal and routes it through agents.

Demo states:

1. Goal received
2. Plan generated
3. Agents assigned
4. Workflow running
5. Human checkpoint
6. Output delivered
7. Audit log written

Acceptance criteria:

- demo works without login
- user can replay the run
- CTA routes to `/app` or `/workflows`
- copy explains human-in-the-loop governance

## Phase 4 — Video and product loops

Add short homepage demo tiles for:

- Command Center
- Knowledge Graph
- Workflow Builder
- AI Movie Studio
- Security Command Center
- Marketplace

Acceptance criteria:

- video assets are compressed
- autoplay respects reduced-motion preferences
- poster images exist for every loop
- mobile loads static posters first

## Phase 5 — Marketplace preview

Add a featured catalog section for deployable agents.

Agent cards:

- Hermes Operator
- Research Scout
- Builder Agent
- Security Sentinel
- Marketing Engine
- Compliance Reviewer
- Video Studio Agent
- Voice Interface Agent

Acceptance criteria:

- cards link to `/marketplace`
- each agent has role, status, category, and CTA
- no paid claims or unsupported revenue claims appear

## Phase 6 — Enterprise trust center

Create a public trust narrative that supports enterprise buyers.

Sections:

- system status
- audit logs
- role-based access
- observability
- deployment options
- data governance
- security roadmap
- compliance readiness

Acceptance criteria:

- `/security` links into trust content
- homepage trust cards link to security pages
- compliance language is roadmap-based unless certification is confirmed

## Phase 7 — Performance and accessibility

Hardening checklist:

- Lighthouse performance target: 90+
- Lighthouse accessibility target: 95+
- reduced-motion support for animations
- lazy-load below-fold visuals
- keep first-paint hero assets minimal
- include alt text for all meaningful images
- keyboard-visible focus states

## Recommended PR sequence

1. `feat(home): use public telemetry endpoint`
2. `feat(home): add interactive knowledge graph section`
3. `feat(home): add Hermes command center demo`
4. `feat(home): add marketplace preview and demo loops`
5. `feat(security): add enterprise trust center`
6. `perf(home): harden homepage performance and accessibility`

## Production note

The homepage should feel like an AI operating system, but should only expose public-safe metrics. Any internal tables, task IDs, tenant IDs, user IDs, secret keys, admin actions, logs, or private workflow details must stay behind authenticated routes.
