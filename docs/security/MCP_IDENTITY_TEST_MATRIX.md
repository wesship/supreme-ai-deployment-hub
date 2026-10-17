# MCP identity regression test matrix

Status: NOT EXECUTED. These are acceptance cases, not passing results.

| Case | Expected result |
|---|---|
| Missing HNF service credential | 401 (or 503 when unconfigured); no task created |
| Valid service credential, unconfigured service principal | Fail closed; no task created |
| Valid credential, service principal matches server configuration | Request can proceed subject to workflow policy |
| Caller claims another actor ID | Reject; no task created |
| Caller claims actor type user or agent using a service credential | Reject; no task created |
| Unknown workflow | Structured error; no task created |
| Reused request ID with different actor or payload | Reject conflict; no cross-actor replay |
| Approval by unauthorized service identity | Reject; task remains paused |
| Expired, revoked, or already consumed approval | Reject; task remains paused |
| Cross-tenant request status lookup | Reject without leaking task existence |
| Malformed JSON-RPC arguments | Structured error; no task created |
| Successful authorized request | Actor identity and audit trail reflect verified principal |

Implementation notes: derive identity from authenticated server context; do not trust request-supplied identity fields. Verify compatibility with existing HNF clients before rollout. Do not enable production execution or merge before the tests and staging checks pass.
