# D3VONN Influencer Studio

Foundation gate for synthetic-persona campaign orchestration.

## Scope

This package intentionally stops at `READY_TO_PUBLISH` for initial certification. External social publishing, customer messaging, and monetization are separate gates.

## Components

- `Persona`: canonical synthetic-character identity and provenance contract.
- `Campaign`: deterministic campaign lifecycle with validated transitions.
- `MediaProvider`: provider-neutral generation interface.
- `ProviderRegistry`: capability discovery so Hermes can route work without coupling to one vendor.

## Planned providers

- Eromify adapter after its actual integration contract is verified.
- ComfyUI adapter for self-hosted workflows.
- Wan adapter for open-source video generation/animation where deployment requirements permit.

## Required controls

- Synthetic disclosure is mandatory.
- Persona declared age must be 21+.
- Imported reference assets require provenance/rights metadata before production publishing.
- Provider outputs must retain generation provenance.
- QA and approval occur before `READY_TO_PUBLISH`.

## Campaign lifecycle

`DRAFT -> PLANNING -> GENERATING -> QA -> APPROVAL -> READY_TO_PUBLISH`

Later publishing gates extend this through:

`SCHEDULED -> PUBLISHED -> MEASURING -> OPTIMIZING -> COMPLETED`

Failure and approval-pause states are explicit and fail closed.
