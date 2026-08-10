# Agent OS Controlled Staging Rollout

## Purpose

This runbook is the release gate between merged Agent OS governance code and any broader production execution rollout. It validates that named and capability dispatch fail closed, honor workspace policy and approvals, and produce correlated audit evidence.

## Preconditions

- `main` contains governed named and capability dispatch.
- Staging uses non-production Supabase and provider credentials.
- A dedicated staging workspace exists with at least one `workspace_admin` and one non-admin member.
- At least one registered Agent Mesh provider is healthy.
- Staging audit writes to `primetime_audit_events` are queryable.
- No production workspace or production provider credential is used during these drills.

## Required drills

### 1. Workspace kill switch

1. Enable the Agent OS workspace kill switch through the governance control API.
2. Attempt a named dispatch for a normally allowed capability.
3. Attempt the same capability through capability dispatch.
4. Verify both requests are denied before provider execution.
5. Verify decision audit evidence exists for each attempt.
6. Disable the kill switch and verify the policy state is restored.

**Pass:** no provider execution occurs while the kill switch is enabled.

### 2. Disabled agent

1. Disable one registered agent in the workspace policy.
2. Attempt direct named dispatch to that agent.
3. Verify denial before provider execution and decision audit evidence.
4. Re-enable the agent.

**Pass:** a disabled agent cannot execute even when its capability would otherwise be allowed.

### 3. Approval-required action

1. Use a capability classified as requiring approval.
2. Attempt dispatch without active approval.
3. Verify HTTP 409 and zero provider execution.
4. Grant a time-bounded approval.
5. Repeat the request and verify it is permitted only if all other policy checks pass.
6. Revoke the approval and verify execution is blocked again.

**Pass:** approval state changes execution eligibility exactly as expected and all mutations are audited.

### 4. Explicit deny

1. Use a request that fails permission or tool/agent binding policy.
2. Verify HTTP 403.
3. Verify provider execution does not occur.
4. Verify the decision audit records `deny` and the reason.

**Pass:** explicit deny never reaches Agent Mesh execution.

### 5. Mandatory pre-dispatch audit outage

1. In staging only, make the audit write path unavailable to the API process or inject a controlled audit failure.
2. Attempt an otherwise allowed dispatch.
3. Verify HTTP 503.
4. Verify provider execution does not occur.
5. Restore the audit path.

**Pass:** an allowed action fails closed when mandatory decision evidence cannot be persisted.

### 6. Provider exception and outcome evidence

1. Use a staging provider configured to raise a controlled exception after dispatch begins.
2. Verify the API surfaces the provider failure.
3. Verify outcome audit evidence is attempted with the same task ID as the decision event.

**Pass:** provider exceptions do not erase evidence of the attempted execution.

### 7. Allowed named dispatch

1. Choose a low-risk capability that is registered for a healthy agent and allowed for the staging workspace role.
2. Dispatch through the named route.
3. Verify ordering: decision audit -> provider execution -> outcome audit.
4. Verify the decision and outcome events share one task ID.

**Pass:** only explicit `allow` reaches the provider and the audit chain is correlated.

### 8. Allowed capability dispatch

1. Dispatch the same low-risk capability through the capability route.
2. Verify a healthy candidate is selected.
3. Verify the selected candidate is routed through the governed named-dispatch implementation.
4. Verify the same decision/outcome evidence guarantees as named dispatch.

**Pass:** capability dispatch has no alternate governance bypass.

### 9. Candidate health selection

1. Put an unhealthy candidate first in the capability candidate set.
2. Keep a second candidate healthy.
3. Verify the unhealthy candidate is skipped and the healthy candidate is governed before execution.
4. Mark all candidates unhealthy and verify HTTP 503.

**Pass:** health selection never bypasses governance and no healthy candidate returns 503 without execution.

## Evidence to capture

For every drill capture:

- staging workspace ID
- authenticated actor ID and role
- route used
- capability and selected agent
- expected governance decision
- actual HTTP status
- task ID when one is created
- matching `primetime_audit_events` decision row
- matching outcome row when execution begins
- provider-side execution confirmation or confirmation of no execution
- timestamp and operator

## Stop conditions

Stop the rollout immediately if any of the following occurs:

- a deny or approval-required request reaches a provider;
- the kill switch fails to block execution;
- a disabled agent executes;
- an allowed request executes without mandatory decision evidence;
- capability dispatch executes outside the named-governance path;
- task IDs do not correlate decision and outcome evidence;
- a staging drill touches production data, credentials, or workspaces.

## Promotion criteria

Production rollout remains blocked until all required drills pass in a clean staging environment, evidence is retained, and the staging workspace is returned to its normal policy state. Initial production enablement should be internal-only and canary-based, with the workspace kill switch tested and immediately available.