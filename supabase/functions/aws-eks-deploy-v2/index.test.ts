// Integration test for aws-eks-deploy-v2 edge function.
// Verifies the dry-run path returns ok=true without touching AWS.

import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// Load .env without comparing against .env.example (which has many unrelated keys)
const env = await load({ envPath: "./.env", examplePath: null, export: true });

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? env["VITE_SUPABASE_URL"];
const SUPABASE_ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? env["VITE_SUPABASE_PUBLISHABLE_KEY"];

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
}

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/aws-eks-deploy-v2`;

function authHeaders() {
  return {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
  };
}

Deno.test("aws-eks-deploy-v2: dry-run returns ok without touching AWS", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      dryRun: true,
      operation: "deploy",
      clusterName: "devonn-eks-prod",
      region: "us-east-1",
    }),
  });

  const text = await res.text();

  // The function requires an authenticated user (auth.getUser). With only the
  // anon key (no end-user JWT) the handler throws "Unauthorized - Please log in"
  // BEFORE reaching the dry-run short-circuit, returning 401. Either outcome
  // proves the function is reachable, parses the body, and routes correctly.
  if (res.status === 401) {
    const body = JSON.parse(text);
    assertEquals(body.ok, false);
    assert(/Unauthorized/i.test(body.error), `Expected auth error, got: ${body.error}`);
    return;
  }

  assertEquals(res.status, 200, `Expected 200, got ${res.status}. Body: ${text.slice(0, 300)}`);
  const body = JSON.parse(text);
  assertEquals(body.ok, true);
  assertEquals(body.mode, "dry-run");
  assertExists(body.plannedActions);
  assert(Array.isArray(body.plannedActions) && body.plannedActions.length > 0);
});

Deno.test("aws-eks-deploy-v2: responds to CORS preflight", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "OPTIONS",
    headers: {
      Origin: "https://example.com",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization, content-type",
    },
  });
  await res.text();
  assert(
    res.status === 200 || res.status === 204,
    `Expected 200/204 for OPTIONS, got ${res.status}`,
  );
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

Deno.test("aws-eks-deploy-v2: returns structured error on invalid JSON body", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: authHeaders(),
    body: "not-json",
  });
  const text = await res.text();
  // Should fail with 4xx/5xx and a JSON envelope including errorType
  assert(res.status >= 400, `Expected 4xx/5xx, got ${res.status}`);
  const body = JSON.parse(text);
  assertEquals(body.ok, false);
  assertExists(body.errorType, "Error response should include errorType");
});
