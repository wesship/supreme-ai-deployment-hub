# P0 Approval Enforcement Certification

Baseline: `main@5b0766a7aef8afe5da5e8950a26ea62332f82a39`

Certification scope: protected/destructive security actions, tool-policy approval behavior, replay/concurrency resistance, and the boundary between approval and execution.

## Result

**PARTIAL — fail-closed behavior exists, but full Gate 17/18/59 approval certification is not yet complete.**

## Evidence on canonical main

### 1. Tool policy fails closed

`backend/app/security/tool_registry.py`

- unknown tools and capabilities are denied;
- general agents are denied by default;
- active production capabilities can require both asset authorization and human approval;
- restricted exploitation capabilities remain sandbox/lab/test only;
- policy evaluation is separate from actual execution.

Tests:
- `backend/tests/test_security_tool_registry.py`
- `backend/tests/test_security_tool_registry_routes.py`

The route tests additionally prove that policy evaluation does not execute the underlying tool.

### 2. Destructive containment uses an explicit approval state machine

`backend/app/security/approval_execution.py`

Observed lifecycle:

```text
pending_approval
      ↓ admin approval
approved
      ↓ atomic execution claim
executing
      ↓
executed | dry_run | execution_failed
```

Important controls already present:

- admin identity is required;
- only rows in `pending_approval` can be approved/rejected;
- only destructive action types enter this approval path;
- execution requires `approved` state;
- execution claims the row with a compare-and-set `status=approved → executing` update;
- concurrent claim failure stops execution;
- missing executor remains `not_executed`;
- executor cancellation/failure produces an explicit failure state.

Tests:
- `backend/tests/test_approval_execution.py`
- `backend/tests/test_repository_audit_remediations.py`

### 3. Database lifecycle is constrained

`supabase/migrations/20260912094500_hermes_security_action_approval_state.sql`

- legacy pending records are quarantined as `legacy_pending`;
- only explicit new `pending_approval` rows can enter approval;
- status values are constrained;
- approval/execution queue indexes exist.

## Certification matrix

| Requirement | Result | Evidence |
|---|---|---|
| Unknown tool fails closed | PASS | tool registry + tests |
| Unauthorized agent fails closed | PASS | tool registry + tests |
| Active action can require human approval | PASS | tool registry + tests |
| Restricted red capability denied in production | PASS | tool registry + tests |
| Unapproved destructive action cannot execute | PASS | approval service + tests |
| Duplicate concurrent execution claim is rejected | PASS | CAS state transition + remediation test |
| Missing executor cannot claim success | PASS | approval execution test |
| Approval identity recorded | PASS | approval service + tests |
| Approval bound to immutable payload hash | **GAP** | no canonical action payload hash checked at execution |
| Approval expiration / TTL | **GAP** | no expiry check in approval execution service |
| Approval is single-use across crash/retry boundary | PARTIAL | state CAS prevents normal replay; crash semantics need live persistence test |
| General Hermes interrupt/checkpoint resume binding | **GAP / separate path** | security action service is not yet proof of generic Hermes interrupt certification |
| Production runtime proof | **BLOCKED** | requires live Supabase/API canary |

## Required remediation before VERIFIED

### A. Bind approval to exact action payload

At approval time, compute a canonical hash of the execution-relevant action fields and store it with approval metadata.

At execution time:

```text
current_payload_hash == approved_payload_hash
    ? continue
    : deny and require a new approval
```

The hash must exclude mutable audit-only fields such as the approval/execution records themselves.

### B. Add approval expiry

Approval metadata should include an explicit expiration time. Execution after expiry must fail closed and return the action to a state requiring fresh approval.

### C. Live persistence/replay canary

Against the production-like database:

1. create one bounded test action;
2. approve it;
3. attempt two concurrent execution claims;
4. prove only one claim can proceed;
5. restart the API/worker between approval and execution;
6. verify the approval remains valid only for the original payload;
7. retry after terminal execution and prove no second side effect occurs.

### D. Generic Hermes interrupt linkage

Separately certify that `hermes_interrupts` + checkpoints use the same properties:

- exact action/payload binding;
- authorization;
- expiry;
- single consumption;
- restart-safe resume.

## Gate status

```text
Gate 17 — Tool Registry + Permission Enforcement .... IMPLEMENTED
Gate 18 — Human Approval + Interrupt/Resume ......... PARTIAL
Gate 24 — Zero-Trust Runtime ........................ PARTIAL
Gate 59 — Protected-Action Certification ............ PARTIAL
```

## Pass condition

Promote this certification to `VERIFIED` only after payload binding, expiry, generic interrupt/resume evidence, and live replay/persistence tests all pass.
