# D3VONN Multi-Provider AI Film Orchestrator

Tracks the implementation of GitHub issue #698.

## Goal

Extend the existing D3VONN Studios/OpenMontage workflow into a governed, provider-neutral film production system supporting Grok Imagine, Higgsfield, Runway, Luma, ElevenLabs, and a mock provider.

## Delivery phases

1. Schema and RLS
2. Provider contracts and mock provider
3. Job lifecycle service
4. Grok Imagine adapter
5. ElevenLabs adapter
6. Shot Builder and version comparison
7. Higgsfield bridge
8. Runway and Luma adapters
9. Automated visual QA
10. Timeline export

## Security invariants

- Provider credentials remain server-side only.
- No provider key may use a frontend-exposed prefix.
- Requests and responses must be redacted before logging.
- Asset access must use signed or short-lived URLs.
- Every project, scene, shot, generation, review, and timeline item is owner-scoped and protected by RLS.

## First vertical slice

A Sovereign Signal shot moves through canon-aware prompt assembly, provider routing, generation, status polling, QA, human approval, and timeline placement.
