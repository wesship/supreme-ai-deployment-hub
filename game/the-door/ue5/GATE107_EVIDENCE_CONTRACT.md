# Gate 107 Evidence Contract

Gate 107 is certified only from evidence produced against one exact Git commit and one exact Unreal Engine 5.3 toolchain.

Required stages:

1. Project files generated successfully.
2. `DEVONN_AIEditor Win64 Development` builds successfully.
3. `TheDoor.Retro` automation tests pass.
4. Editor boots and PIE runtime smoke succeeds.
5. Retro state persists across a cold restart.
6. Project cooks and packages successfully.
7. Packaged build launches offline with optional D3VONN.IO/Hermes/GODMOD3/LLM services unavailable.

The GitHub workflow intentionally fails closed if the reconstructed project has not been landed under `game/the-door/ue5/project/`. A queued or skipped workflow is not certification.

Status values remain: `DEFINED_ONLY`, `SCAFFOLDED`, `PARTIALLY_IMPLEMENTED`, `IMPLEMENTED`, `VERIFIED`, `CERTIFIED`.
