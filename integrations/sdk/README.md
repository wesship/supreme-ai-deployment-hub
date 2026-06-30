# @d3vonn/sdk

The official TypeScript SDK for the D3VONN Autonomous Runtime Platform.

## Installation

```bash
npm install @d3vonn/sdk
```

## Usage

The SDK provides two clients: `DevonnClient` (base) and `TenantAwareClient` (for multi-tenant environments).

### Basic Usage

```typescript
import { DevonnClient } from "@d3vonn/sdk";

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
import { TenantAwareClient } from "@d3vonn/sdk";

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
import { DevonnApiError } from "@d3vonn/sdk";

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
