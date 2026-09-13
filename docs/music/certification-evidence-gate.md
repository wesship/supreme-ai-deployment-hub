# ACE-Step 1.5 production certification evidence gate

Production activation remains blocked until the external qualification evidence is real, complete, and reviewable.

## Current state

- Provider: `ace-step-1.5`
- Source revision: `ca1e85fe9430179831e6bc6be790c332190a3866`
- Model revision: `19671f406d603126926c1b7e2adc169acbcade22`
- Production dispatch: disabled
- Certification state: `PENDING_EXTERNAL_EVIDENCE`

## Evidence required for PASS

1. SHA-256 manifest covering every model weight/checkpoint actually loaded by the runtime.
2. Aggregate manifest SHA-256 recorded in the production certification record.
3. Final dependency-license review for the exact runtime environment/SBOM.
4. Private GPU identity: model, driver, CUDA, Torch, and ACE-Step version.
5. At least 25 successful controlled generations.
6. Generation error rate no greater than 2%.
7. p95 generation latency no greater than 120 seconds.
8. Deterministic fixed-seed generation match.
9. Audio-QA pass plus SHA-256 of the QA report.
10. Provenance manifest SHA-256.
11. Reviewer identity and valid review timestamp.

## Activation boundary

A PASS certification is evidence only. The certification file itself must keep `production_enabled` false. Enabling hosted/commercial dispatch requires a separate reviewed registry change after qualification passes. Auto-routing remains disabled until at least two providers independently qualify.

## Paid compute boundary

Do not launch paid GPU infrastructure solely from repository state. GPU qualification must use an already-approved private target or an explicitly authorized paid-compute target.
