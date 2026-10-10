# @devonn/sdk

The official TypeScript SDK for the Devonn.ai Autonomous Runtime Platform.

## Installation

```bash
npm install @devonn/sdk
```

## Usage

The SDK provides two clients: `DevonnClient` (base) and `TenantAwareClient` (for multi-tenant environments).

### Basic Usage

```typescript
import { DevonnClient } from "@devonn/sdk";

const client = new DevonnClient({
  baseUrl: "https://api.d3vonn.io/v1",
  apiKey: "your-api-key"
});

// Start an autonomous agent run
const run = await client.startRun({
  agentId: "ag_data_analyst",
  goal: "Analyze Q3 revenue metrics"
});

// Wait for completion
const result = await client.waitForRun(run.runId);
console.log(result.status); // "completed"
```

### Tenant-Aware Usage (Recommended for Production)

The `TenantAwareClient` automatically handles API key prefixing, rate limit detection, and exponential backoff for HTTP 429 responses.

```typescript
import { TenantAwareClient } from "@devonn/sdk";

const client = new TenantAwareClient({
  baseUrl: "https://api.d3vonn.io/v1",
  apiKey: process.env.DEVONN_API_KEY, // e.g., dvn_pro_123456...
  autoRetryRateLimits: true,          // Automatically wait and retry on 429
  maxRateLimitWaitMs: 60000,          // Max time to wait before throwing
});

// Execute requests normally
const run = await client.startRun({
  agentId: "ag_researcher",
  goal: "Compile competitor analysis"
});

// Check rate limit status from the last request
const status = client.getRateLimitStatus();
if (status) {
  console.log(`Remaining requests: ${status.remaining}`);
  console.log(`Limits reset at: ${status.resetAt.toISOString()}`);
}
```

## Error Handling

The SDK throws `DevonnApiError` for all non-2xx responses.

```typescript
import { DevonnApiError } from "@devonn/sdk";

try {
  await client.getRun("invalid-id");
} catch (error) {
  if (error instanceof DevonnApiError) {
    console.error(`Status: ${error.status}`); // 404
    console.error(`Code: ${error.code}`);     // "NOT_FOUND"
    console.error(`Message: ${error.message}`);
  }
}
```
