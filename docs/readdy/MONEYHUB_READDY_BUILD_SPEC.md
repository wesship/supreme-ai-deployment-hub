# D3VONN.IO MoneyHub — Readdy Build Specification

## Goal

Redesign `/moneyhub` as a premium financial-intelligence and agent-revenue operations workspace inside D3VONN.IO. Readdy is the visual design/prototyping layer only. The canonical application remains `wesship/supreme-ai-deployment-hub`, and the canonical financial data remains in the existing D3VONN/Supabase backend.

## Existing backend contract

The repo already contains:

- `money_agents`: user-owned money-agent records with status, category, runs, total earned, last run and configuration.
- `agent_earnings`: user-owned earnings events with amount, source, description, metadata and timestamp.
- Row-level security protecting each user's records.
- Supabase realtime enabled for `agent_earnings`.

Do not replace these tables with a Readdy-only database. Do not invent earnings or balances in production. Demo data must be explicitly labeled `Demo` or `Preview`.

## Product positioning

**MoneyHub — Govern revenue intelligence across your AI workforce.**

MoneyHub should feel like a sovereign financial command center for the D3VONN agent ecosystem. It is not a bank, brokerage, investment adviser, tax adviser, or custodial wallet. It is an operational intelligence and automation layer for tracking agent-generated revenue, costs, ROI, payout/reconciliation status and financial workflow signals.

## Design direction

Use the current D3VONN Sovereign Signal system:

- deep black / graphite / titanium surfaces
- electric cyan / blue signal accents
- restrained green only for verified positive financial state
- amber for warnings / reconciliation needed
- red only for failures, losses or blocked actions
- bright high-contrast body text; never low-contrast gray on dark backgrounds
- technical glass/titanium panels, subtle grid lines, fine borders, telemetry glow
- no generic crypto dashboard look
- no fake bank balance aesthetics
- desktop-first operations cockpit, excellent mobile collapse

## Page hierarchy

### 1. MoneyHub command hero

Eyebrow: `D3VONN.IO MONEYHUB`
Title: `Command the economics of your AI workforce.`
Description: `Track agent-generated revenue, operating costs, ROI, payouts, reconciliation and automation signals from one governed financial intelligence layer.`

Primary CTA: `Open Revenue Command`
Secondary CTA: `Review Money Agents`

Status chips:
- `Financial telemetry`
- `Governed workflows`
- `Realtime earnings events`
- `User-scoped data`

### 2. Financial command strip

Four metric cards. When real data is unavailable show `—` rather than fabricated values.

- Gross Agent Revenue
- Operating Cost
- Net Contribution
- Active Money Agents

Each card supports trend, period selector and data-source badge.

### 3. Revenue intelligence chart

Large time-series panel with:
- gross revenue
- cost
- net contribution
- event markers
- 24H / 7D / 30D / 90D / YTD
- source filters

Chart must support an explicit `No connected earnings yet` empty state.

### 4. Money Agent fleet

Table/cards sourced from `money_agents`:
- agent name
- category
- status
- total earned
- run count
- last run
- ROI / cost efficiency when cost data exists
- open details

Statuses: idle, running, paused, error.

### 5. Earnings event ledger

Realtime feed sourced from `agent_earnings`:
- timestamp
- agent
- source
- amount
- description
- metadata drawer

This is an operational ledger view, not a legal accounting ledger unless separately certified.

### 6. Agent ROI leaderboard

Rank agents using real data only. Support:
- revenue
- cost
- net contribution
- success rate
- revenue/run
- trend

If cost data is missing, label ROI as `Not available` instead of calculating from assumptions.

### 7. Payout & reconciliation workspace

Create a visual operations module for future governed payout/reconciliation workflows:
- pending reconciliation
- matched
- exception
- approved for payout
- paid

Do not show a working transfer button unless a real backend/payment provider and authorization flow is implemented.

### 8. Financial automation

Cards for governed workflows:
- reconcile earnings
- flag unusual revenue events
- generate monthly operating summary
- notify on agent revenue drop
- pause money agent on repeated errors
- export accounting package

Each automation card shows required permissions and whether it is active.

### 9. MoneyHub Intelligence

Add an AI analysis panel that can summarize the connected MoneyHub dataset and answer questions such as:
- `Which agents contributed the most net revenue this month?`
- `Where did revenue fall week over week?`
- `Which agents have high runs but low revenue?`

The assistant must distinguish observed data from inference and must not provide personalized investment, tax or legal advice as if it were professional advice.

### 10. Governance / trust panel

Show:
- data source
- last sync
- RLS protected
- audit events
- connected integrations
- permissions
- export history

### 11. Enterprise CTA

Title: `Turn every autonomous workflow into measurable economics.`
Primary: `Launch MoneyHub`
Secondary: `Connect financial data`

## Navigation

MoneyHub should fit inside D3VONN navigation and link to:
- Command Center
- Agents
- Automation
- Marketplace
- DKOS / Knowledge
- Trust / Security

Do not create a separate product brand disconnected from D3VONN.IO.

## Readdy implementation rules

1. Build a high-fidelity responsive page and reusable components.
2. Preserve route name `/moneyhub`.
3. Use React / Next.js-compatible component structure that can be translated back into the existing Vite/React repo.
4. Do not make Readdy the production backend.
5. Do not invent banking, brokerage, wallet, custody or money-transfer functionality.
6. Do not fabricate revenue numbers. Demo values must be visibly labeled.
7. Keep all financial action buttons non-mutating until connected to governed backend actions.
8. Produce components that map cleanly to the existing D3VONN shell and design tokens.

## Component map

- `MoneyHubHero`
- `MoneyHubMetricStrip`
- `RevenueIntelligenceChart`
- `MoneyAgentFleet`
- `EarningsEventLedger`
- `AgentROILeaderboard`
- `ReconciliationWorkspace`
- `FinancialAutomationPanel`
- `MoneyHubIntelligence`
- `MoneyHubTrustPanel`
- `MoneyHubEnterpriseCTA`

## Acceptance criteria

- page is visually consistent with D3VONN Sovereign Signal
- typography is bright and readable against dark surfaces
- no fake financial balances or misleading claims
- explicit empty/loading/error/demo states
- desktop, tablet and mobile layouts
- accessible keyboard navigation and contrast
- clear source labels on financial metrics
- maps to existing `money_agents` and `agent_earnings` backend structures
- safe handoff back to `supreme-ai-deployment-hub`
