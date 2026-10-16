# Factory dependency repair gate — 2026-10-16

Base inspected: 504e286f0071536d07b9e8750bdada78af614762. Draft PR: #1426.

## Repair and verification
The planner previously accepted a completed direct dependency even when an ancestor remained incomplete. It now traverses all prerequisites, checks their completion, and excludes unrelated graph branches. Added regression coverage for missing ancestors, shared ancestors, complete chains, and denial before verifier invocation.

Baseline: 22 tests passed.
Before fix: two new regression tests failed as expected.
After fix: python -m unittest discover -s factory -t . -v — 26 tests passed, exit 0.
Tests ran offline against the factory files retrieved from the base revision plus this patch. Full repository integration and live E2E scenarios were not run.

## Reuse and gap inventory
| Source inspected at base revision | Reuse | Remaining evidence |
| --- | --- | --- |
| docs/hermes-distributed-workers.md | Existing worker selection, one active lease, heartbeat and drain semantics | Documentation identifies InMemoryWorkerRegistry as reference adapter; persistent acquisition and restart reconciliation not verified |
| docs/hermes-checkpoint-recovery.md | Bound tasks wait for reconciliation; checkpoint validation and replay identities | Factory task-to-checkpoint integration and interrupted-worker scenario not run |
| package.json | Existing lint, typecheck, unit, Playwright and release commands | No new complete factory pilot evidence |
| factory/approval_binding.py | Scope fingerprint and trusted-verifier boundary | Authoritative identity/store adapter and revocation checks not integrated |
| factory/dispatch.py | Deterministic task key, DAG and prerequisite checks | Pure planner only; no runtime task acquisition |
| factory/harness/END-TO-END.md | Five public acceptance journeys | All remain specifications, not executed E2E tests |

General CI checks on the base revision reported success, with deployment jobs skipped. The dedicated Factory Safety Unit Tests job was not present in the inspected base check-run list; this report's factory test result is local, not CI certification.

## Next gate
Implement and verify the persistent Hermes lease adapter and authoritative completion/approval inputs, preserving the existing scheduler. Demonstrate idempotent acquisition and interrupted-worker reconciliation before attaching a builder. Independent acceptance, isolated workspaces, evidence collection, bounded retries, staging and supervised pilot remain open.

Release HOLD. This repair neither enables dispatch nor authorizes merge or production.
