# Factory Dependency Backlog

Tracking issue: #1425. All tasks are proposals, not yet created as separate issues.

| ID | Gate | Depends on | Exit criterion |
| --- | --- | --- | --- |
| F01 | Inventory existing Hermes and CI | — | Reuse/gap matrix reviewed |
| F02 | Human-approved mission/PRD | F01 | Signed-off bounded scope |
| F03 | Independent acceptance harness | F02 | Holdouts isolated from builders |
| F04 | Policy and approval contract | F02 | Deny-by-default tests |
| F05 | Issue graph and cycle validation | F02 | DAG tests pass |
| F06 | Issue-to-lease adapter | F04,F05 | Idempotent dispatch tests |
| F07 | Isolated builder workspace | F06 | Branch isolation verified |
| F08 | Draft PR evidence collector | F07 | SHA/CI/artifacts recorded |
| F09 | Independent code review | F03,F08 | Reviewer verdict recorded |
| F10 | Bounded repair loop | F09 | Retry exhaustion escalates |
| F11 | Staging batch validator | F09,F10 | E2E/security gates pass |
| F12 | Human staging acceptance | F11 | Approval recorded |
| F13 | Production authorization design | F12 | Explicit approval and rollback rehearsed |
| F14 | Observability and budget controls | F06 | Time/cost alerts verified |
| F15 | Supervised pilot and rollback | F11,F14 | Full lap verified without auto-merge |

## Default proposed limits (subject to approval)
One pilot issue; one active worker; at most two repair retries; no automatic production actions. Budget and wall-clock limits must be specified by the operator before execution.

## Release HOLD
Do not enable factory dispatch or deploy until F01–F15 evidence is reviewed and authorized.
