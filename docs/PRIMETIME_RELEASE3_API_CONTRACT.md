# PRIMETIME Release 3 — Communications API Contract

## Overview

Consent-governed communications API. The system does not send messages autonomously.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /primetime/v1/communications | List communications |
| POST | /primetime/v1/communications | Create draft communication |
| PATCH | /primetime/v1/communications/{id} | Update communication |
| GET | /primetime/v1/consent-records | List consent records |
| POST | /primetime/v1/consent-records | Record consent |

## Blocked Endpoints

- No `/send` endpoint — all sending requires human approval
- No DELETE endpoint — regulated records are never deleted
- Autonomous outbound delivery is explicitly forbidden

## Governance

- Consent state must be verified before any dispatch
- Communication templates are draft-only until approved
