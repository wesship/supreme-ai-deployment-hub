/**
 * Example: Start an agent run and wait for completion
 */
import { DevonnClient, DevonnApiError } from "@devonn/sdk";

const client = new DevonnClient({
  apiKey: process.env.DEVONN_API_KEY ?? "",
  baseUrl: process.env.DEVONN_API_URL,
});

async function main() {
  try {
    // Start a new run
    const run = await client.startRun({
      agentId: "00000000-0000-0000-0000-000000000001",
      goal: "Summarize the latest deployment metrics and flag any anomalies",
      idempotencyKey: `example-run-${Date.now()}`,
    });

    console.log(`Run started: ${run.id} (status: ${run.status})`);

    // Poll until completion (max 5 minutes)
    const result = await client.waitForRun(run.id, {
      pollIntervalMs: 3000,
      timeoutMs: 300_000,
    });

    if (result.status === "completed") {
      console.log("Run completed successfully:", result.result);
    } else {
      console.error("Run ended with status:", result.status, result.error);
    }
  } catch (err) {
    if (err instanceof DevonnApiError) {
      console.error(`API error ${err.statusCode} [${err.code}]: ${err.message}`);
    } else {
      throw err;
    }
  }
}

main();
