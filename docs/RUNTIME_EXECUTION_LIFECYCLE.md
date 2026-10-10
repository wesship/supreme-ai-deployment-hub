# DEVONN.AI Runtime Execution Lifecycle

## Purpose

This document defines the canonical autonomous execution lifecycle.

The lifecycle exists to ensure deterministic execution governance.

---

# Canonical States

| State | Meaning |
|---|---|
| PENDING | task created and awaiting acquisition |
| LOCKED | scheduler or worker lease acquired |
| RUNNING | actively executing |
| RETRY | retry scheduled |
| PAUSED | intentionally paused |
| MANUAL_REVIEW | awaiting human review |
| ESCALATED | routed for elevated handling |
| FAILED | terminal failure |
| COMPLETED | successful completion |
| STALE | ownership/heartbeat expired |
| QUARANTINED | isolated due to safety concern |

---

# Valid State Transitions

```text
PENDING -> LOCKED
LOCKED -> RUNNING
RUNNING -> COMPLETED
RUNNING -> RETRY
RUNNING -> ESCALATED
RUNNING -> FAILED
RUNNING -> STALE
RETRY -> LOCKED
ESCALATED -> MANUAL_REVIEW
MANUAL_REVIEW -> RETRY
MANUAL_REVIEW -> QUARANTINED
STALE -> RETRY
STALE -> MANUAL_REVIEW
```

Invalid transitions should be logged and rejected.

---

# Required Runtime Metadata

Each execution should maintain:

- task ID
- execution ID
- lineage ID
- correlation ID
- scheduler owner
- worker owner
- lease expiration
- retry count
- replay ID if applicable
- timestamps
- escalation reason if applicable

---

# Ownership Rules

A worker must not execute a task unless:

- the lease is valid
- the task is not stale
- ownership is recorded
- replay safety is verified where applicable

---

# Heartbeat Rules

Workers should emit heartbeats at deterministic intervals.

Recommended:

- heartbeat interval < lease expiration threshold
- stale detection should be automatic
- scheduler arbitration should preserve lineage

---

# Replay Rules

Replay should:

- preserve lineage
- preserve execution attribution
- preserve audit continuity
- avoid duplicate execution

Replay without lineage should be considered unsafe.

---

# Escalation Rules

Escalation should:

- preserve runtime context
- preserve logs
- preserve retry history
- preserve ownership lineage

---

# Circuit Breaker Conditions

Runtime protection should activate for:

- retry storms
- dead-letter spikes
- stale growth
- scheduler lag
- heartbeat collapse
- replay corruption

---

# Operational Goal

The runtime lifecycle should ensure:

- deterministic ownership
- deterministic recovery
- deterministic escalation
- deterministic replay behavior
