# Factory End-to-End Scenarios (design specification)

These are acceptance journeys to implement and independently validate in subsequent gates; they have **not** been executed.

1. **Approved issue to draft PR:** Given a human-approved issue with bounded scope, a Hermes lease is acquired once, the builder works in an isolated branch, and an evidence-linked draft PR is produced. No merge occurs.
2. **Unapproved task:** Given an issue without recorded human approval, dispatch is denied and an auditable reason is emitted. No worker starts.
3. **Failed verification:** Given failing CI or browser evidence, the lap returns to repair within a fixed retry budget; on exhaustion it is escalated without merging.
4. **Worker interruption:** Given a worker lease expiration during a lap, Hermes recovery reconciles the bound task before dispatching replacement work; duplicate side effects are prevented.
5. **Staging rejection:** Given human rejection of a staging batch, follow-up issues are created only with explicit approval; production release stays blocked.

## Holdout separation
Independent evaluator owns private scenario definitions and expected outcomes. Builders see public acceptance criteria but not hidden inputs, evaluator prompts, or private fixtures. Evaluate behavior, not test-name matching.

## Required evidence
For each scenario capture run ID, issue/PR URL, commit SHA, worker lease identity, test commands, exit codes, browser artifacts where applicable, reviewer verdict, and human approval record.

## Current status
Specification only. No scenario has been run in this gate.
