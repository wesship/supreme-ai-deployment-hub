# AI Therapy Kill-Switch / Incident Runbook

## Immediate response

1. Disable the AI Therapy production feature flag.
2. Disable therapeutic voice if the incident involves speech.
3. Disable the affected model/provider if model-specific.
4. Preserve minimal incident metadata; do not copy raw sensitive conversations into routine tickets or logs.
5. Notify the authorized safety/release owner.
6. Record incident severity, affected versions, start/end times, and mitigation.
7. Prevent re-enable until the triggering regression has a reproducible test.

## Severity

- **P0:** credible risk of serious harm, systemic safety bypass, cross-tenant exposure, or inability to escalate.
- **P1:** material safety degradation without evidence of imminent serious harm.
- **P2:** localized defect with no material safety impact.

## Re-enable requirements

- Root cause identified or bounded.
- Regression test added.
- Relevant safety suite passes.
- Privacy/security implications reviewed.
- Rollback or remediation verified.
- Authorized release owner approves.
- Clinical/safety review repeated when the incident changes a clinical or crisis behavior.

## Drill requirement

The kill switch must be exercised periodically in a non-production or controlled environment. Evidence must show that disabling the feature actually prevents generation and downstream actions.
