# PRIMETIME Command Engine v1

Reusable TypeScript parser and policy engine for PRIMETIME prompt codes.

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
- FastAPI parse endpoint
- Interactive React Command Console

## Frontend console

Open:

```text
/primetime-commands
```

The console previews expanded codes, approval requirements, licensed-review requirements, unknown codes, conflicts, and structured JSON output.

## API

Authenticated endpoint:

```text
POST /api/intelligence/commands/parse
```

Request:

```json
{
  "command": "COMPLIANCE-360 + SMS-SEQUENCE + TABLE: Build a follow-up sequence."
}
```

The endpoint parses and evaluates the command but does not execute it.

## TypeScript usage

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

## Package commands

```bash
npm install
npm run build
npm test
```

## Execution contract

Consumers must block operational execution when:

- `unknownCodes` is non-empty
- `conflicts` is non-empty and no precedence rule resolves it
- `humanApprovalRequired` is true and approval is absent
- `licensedReviewRequired` is true and licensed review is absent

The engine does not send messages, place calls, alter CRM records, or perform regulated actions. It only parses and evaluates command intent.

## Current architecture

```text
Prompt-code input
      ↓
TypeScript or FastAPI parser
      ↓
Master-code expansion
      ↓
Conflict and policy evaluation
      ↓
Command Console preview
      ↓
Human/licensed approval gate
      ↓
Future specialist-agent routing
```

## Next integration layer

1. Load the complete canonical command registry.
2. Persist parse and approval audit events.
3. Add specialist-agent routing.
4. Add saved command recipes and favorites.
5. Add approved execution endpoints with idempotency controls.
