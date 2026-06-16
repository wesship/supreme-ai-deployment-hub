# PRIMETIME Command Engine v1

Dependency-light TypeScript parser and policy engine for PRIMETIME prompt codes.

## Features

- `+` command parsing
- Task extraction after `:`
- Space and underscore normalization
- Alias resolution
- Recursive master-code expansion
- Unknown-code reporting
- Conflict detection
- Approval-level escalation
- Human-approval and licensed-review flags
- Output-format detection

## Example

```ts
import { parseCommand } from '@devonn/primetime-command-engine';

const result = parseCommand(
  'COMPLIANCE-360 + SMS-SEQUENCE + TABLE: Build a follow-up sequence.'
);

console.log(result.approvalLevel); // 3
console.log(result.humanApprovalRequired); // true
console.log(result.licensedReviewRequired); // true
```

## Approval levels

- `0`: read-only or informational
- `1`: draft generation
- `2`: human approval required before execution
- `3`: licensed or compliance review required

## Commands

```bash
npm install
npm run build
npm test
```

## Integration contract

Consumers should reject execution when:

- `unknownCodes` is non-empty
- `conflicts` is non-empty and no precedence rule resolves it
- `humanApprovalRequired` is true and approval is absent
- `licensedReviewRequired` is true and licensed review is absent

The package parses and evaluates commands. It does not itself send messages, place calls, modify CRM records, or execute regulated actions.

## Next integration layer

1. Load the full canonical registry.
2. Expose `POST /api/intelligence/commands/parse`.
3. Add the Command Console UI.
4. Route approved commands to specialist agents.
5. Persist execution and approval audit events.
