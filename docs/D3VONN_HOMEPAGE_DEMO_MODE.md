# D3VONN.IO Homepage Demo Mode

Demo Mode exists so D3VONN.IO can always present a polished investor and enterprise buyer experience, even when a backend service is offline, rate-limited, or behind authentication.

## Rules

1. Demo Mode must be clearly public-safe.
2. Demo Mode must never imply unsupported live production metrics.
3. Demo Mode must avoid fake customer counts, fake revenue, or fake compliance claims.
4. Demo Mode may show platform capability, orchestration flow, and simulated interface motion.
5. Demo Mode must degrade gracefully on mobile and reduced-motion devices.

## Public telemetry priority order

1. `/api/public/stats`
2. cached public response
3. static fallback demo values

## Suggested public-safe fallback values

- active agents: Live
- workflows today: Demo
- knowledge graph: Ready
- system status: Operational
- Hermes queue: Standby

## Homepage modules using Demo Mode

- hero telemetry cards
- Hermes orchestration animation
- knowledge graph preview
- marketplace preview
- SOC status preview
- AI Movie Studio preview

## Visual states

### Operational

Show blue glow, active pulse, stable labels, and normal CTA buttons.

### Degraded

Show amber label, keep the page usable, and route users to contact/demo CTAs.

### Offline fallback

Show static visuals and remove claims of live data.

## Copy examples

Preferred:

- `Live public telemetry`
- `Demo orchestration run`
- `Platform preview`
- `Public-safe status`
- `Enterprise pilot ready`

Avoid:

- `Guaranteed uptime`
- `SOC 2 certified` unless confirmed
- `Thousands of customers` unless verified
- private table names or internal IDs

## Implementation checklist

- add one homepage telemetry adapter
- normalize backend response shape
- cache public stats response in frontend state
- use static demo values on network failure
- add reduced-motion guard around animations
- add one Cypress or Playwright smoke test for homepage render
