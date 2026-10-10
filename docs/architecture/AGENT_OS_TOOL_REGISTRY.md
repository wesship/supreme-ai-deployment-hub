# Agent OS Tool Registry

The D3VONN Tool Registry is a metadata boundary in front of the existing Agent Mesh. It does not execute tools.

Each tool declares:

- a stable name and description;
- required workspace permissions;
- risk level;
- side-effect class;
- data sensitivity;
- optional human-approval requirement;
- optional allowed-agent set;
- enabled/disabled state.

## Governance rule

Agents and callers must not self-report tool risk or permissions. Agent OS derives governance inputs from trusted registry metadata, then evaluates those inputs through `backend.agents.governance` before dispatch.

Unknown, disabled, or agent-incompatible tools fail closed.

## Side-effect classes

- `none`
- `internal_write`
- `external_write`
- `communication`
- `financial`
- `destructive`

## Data sensitivity

- `public`
- `internal`
- `confidential`
- `restricted`

## Integration order

1. Stabilize the registry contract and tests.
2. Register existing tools without changing runtime behavior.
3. Resolve workspace permissions and kill switches from governed storage.
4. Require Tool Registry lookup before Agent Mesh dispatch.
5. Reuse existing approval and audit/event infrastructure for evidence.

No new persistence, scheduler, queue, or provider runtime is introduced by this slice.
