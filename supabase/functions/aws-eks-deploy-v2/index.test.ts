// Integration test for aws-eks-deploy-v2 edge function.
// Covers: dry-run (per operation), validation errors, CORS, method guards,
// invalid JSON, real-deploy auth requirement, and an opt-in JWT auth happy path.

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

// Optional JWT auth test creds — only run the JWT happy-path test when set.
const TEST_USER_EMAIL = Deno.env.get("TEST_USER_EMAIL");
const TEST_USER_PASSWORD = Deno.env.get("TEST_USER_PASSWORD");

function authHeaders() {
  return {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
  };
}

async function postDryRun(payload: Record<string, unknown>) {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ dryRun: true, ...payload }),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: JSON.parse(text), raw: text };
}

// ────────────────────────────────────────────────────────────────────────
// Dry-run: operation-specific planned actions
// ────────────────────────────────────────────────────────────────────────

type PlannedAction = {
  id: string;
  title: string;
  type: "read" | "write" | "delete";
  risk: "low" | "medium" | "high";
  requiresAuth: boolean;
  mutatesAws: boolean;
};

const titles = (actions: PlannedAction[]) => actions.map((a) => a.title);

Deno.test("dry-run [deploy]: returns deploy-specific planned actions", async () => {
  const { status, body } = await postDryRun({
    operation: "deploy",
    clusterName: "devonn-eks-prod",
    region: "us-east-1",
  });
  assertEquals(status, 200);
  assertEquals(body.ok, true);
  assertEquals(body.mode, "dry-run");
  assert(Array.isArray(body.plannedActions));
  // Enriched shape: each action is a PlannedAction object
  assert(body.plannedActions.every((a: PlannedAction) => typeof a.id === "string" && typeof a.title === "string"));
  assert(
    titles(body.plannedActions).some((t) => /VPC|subnet/i.test(t)),
    `Deploy plan should mention VPC/subnets. Got: ${JSON.stringify(titles(body.plannedActions))}`,
  );
  // Deploy is mutating + has at least one high-risk step
  assert(body.plannedActions.some((a: PlannedAction) => a.mutatesAws));
  assert(body.plannedActions.some((a: PlannedAction) => a.risk === "high"));
});

Deno.test("dry-run [validate]: returns validate-specific planned actions", async () => {
  const { status, body } = await postDryRun({ operation: "validate", region: "us-east-1" });
  assertEquals(status, 200);
  assertEquals(body.ok, true);
  assert(
    titles(body.plannedActions).some((t) => /No AWS resources changed/i.test(t)),
    `Validate plan should be read-only. Got: ${JSON.stringify(titles(body.plannedActions))}`,
  );
  assert(!titles(body.plannedActions).some((t) => /Create or update/i.test(t)));
  // Pure read-only plan: nothing mutates AWS
  assert(body.plannedActions.every((a: PlannedAction) => !a.mutatesAws));
});

Deno.test("dry-run [status]: read-only plan, accepts 'status' alias", async () => {
  const { status, body } = await postDryRun({
    operation: "status",
    clusterName: "devonn-eks-prod",
    region: "us-east-1",
  });
  assertEquals(status, 200);
  assertEquals(body.ok, true);
  assert(titles(body.plannedActions).some((t) => /Describe EKS cluster/i.test(t)));
});

Deno.test("dry-run [delete]: includes deletion step, accepts 'delete' alias", async () => {
  const { status, body } = await postDryRun({
    operation: "delete",
    clusterName: "devonn-eks-prod",
    region: "us-east-1",
  });
  assertEquals(status, 200);
  assertEquals(body.ok, true);
  assert(titles(body.plannedActions).some((t) => /Initiate cluster deletion/i.test(t)));
  // The deletion step should be typed as "delete"
  assert(body.plannedActions.some((a: PlannedAction) => a.type === "delete"));
});

Deno.test("dry-run [list-clusters]: list-specific plan", async () => {
  const { status, body } = await postDryRun({ operation: "list-clusters", region: "us-east-1" });
  assertEquals(status, 200);
  assert(titles(body.plannedActions).some((t) => /List EKS clusters/i.test(t)));
});

// ────────────────────────────────────────────────────────────────────────
// Schema validation
// ────────────────────────────────────────────────────────────────────────

Deno.test("validation: rejects unknown operation with 400 + ValidationError", async () => {
  const { status, body } = await postDryRun({ operation: "drop-database" });
  assertEquals(status, 400);
  assertEquals(body.ok, false);
  assertEquals(body.errorType, "ValidationError");
  assert(Array.isArray(body.details) && body.details.length > 0);
  assert(
    body.details.some((d: string) => /operation/i.test(d)),
    `Expected operation error in details. Got: ${JSON.stringify(body.details)}`,
  );
});

Deno.test("validation: rejects malformed region", async () => {
  const { status, body } = await postDryRun({
    operation: "validate",
    region: "not a region",
  });
  assertEquals(status, 400);
  assertEquals(body.errorType, "ValidationError");
  assert(body.details.some((d: string) => /region/i.test(d)));
});

Deno.test("validation: rejects invalid clusterName", async () => {
  const { status, body } = await postDryRun({
    operation: "deploy",
    clusterName: "1-bad-start", // must start with a letter
    region: "us-east-1",
  });
  assertEquals(status, 400);
  assertEquals(body.errorType, "ValidationError");
  assert(body.details.some((d: string) => /clusterName/i.test(d)));
});

Deno.test("validation: rejects nodeCount out of range", async () => {
  const { status, body } = await postDryRun({
    operation: "deploy",
    clusterName: "devonn-eks-prod",
    region: "us-east-1",
    nodeCount: 9999,
  });
  assertEquals(status, 400);
  assertEquals(body.errorType, "ValidationError");
});

// ────────────────────────────────────────────────────────────────────────
// CORS hardening
// ────────────────────────────────────────────────────────────────────────

Deno.test("CORS: preflight returns 204 with required headers", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "OPTIONS",
    headers: {
      Origin: "https://example.com",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization, content-type, apikey",
    },
  });
  await res.text();
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  const allowedHeaders = res.headers.get("access-control-allow-headers") ?? "";
  for (const h of ["authorization", "content-type", "apikey", "x-client-info"]) {
    assert(allowedHeaders.toLowerCase().includes(h), `Allow-Headers missing '${h}': ${allowedHeaders}`);
  }
  const allowedMethods = res.headers.get("access-control-allow-methods") ?? "";
  assert(/POST/i.test(allowedMethods) && /OPTIONS/i.test(allowedMethods));
});

Deno.test("CORS: actual responses include Access-Control-Allow-Origin", async () => {
  const { headers } = await postDryRun({ operation: "validate", region: "us-east-1" });
  assertEquals(headers.get("access-control-allow-origin"), "*");
});

Deno.test("Method guard: GET returns 405 with CORS headers", async () => {
  const res = await fetch(FUNCTION_URL, { method: "GET", headers: authHeaders() });
  await res.text();
  assertEquals(res.status, 405);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

// ────────────────────────────────────────────────────────────────────────
// Body parsing + auth boundaries
// ────────────────────────────────────────────────────────────────────────

Deno.test("returns structured BadRequestError on invalid JSON body", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: authHeaders(),
    body: "not-json",
  });
  const text = await res.text();
  assertEquals(res.status, 400);
  const body = JSON.parse(text);
  assertEquals(body.ok, false);
  assertEquals(body.errorType, "BadRequestError");
});

Deno.test("real call (no dryRun) requires a user JWT — anon key returns 401", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: authHeaders(), // anon key only — no end-user JWT
    body: JSON.stringify({ operation: "validate", region: "us-east-1" }),
  });
  const text = await res.text();
  assertEquals(res.status, 401);
  const body = JSON.parse(text);
  assertEquals(body.ok, false);
  assert(/Unauthorized/i.test(body.error));
});

// ────────────────────────────────────────────────────────────────────────
// Opt-in JWT happy path
// Set TEST_USER_EMAIL / TEST_USER_PASSWORD in your env to enable.
// ────────────────────────────────────────────────────────────────────────

Deno.test({
  name: "JWT auth: real call with valid user JWT is no longer 401",
  ignore: !TEST_USER_EMAIL || !TEST_USER_PASSWORD,
  fn: async () => {
    // Sign in via Supabase Auth REST to get an access_token
    const signInRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD }),
    });
    const signInText = await signInRes.text();
    assertEquals(signInRes.status, 200, `Sign-in failed: ${signInText}`);
    const { access_token } = JSON.parse(signInText);
    assertExists(access_token);

    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ operation: "validate", region: "us-east-1" }),
    });
    const text = await res.text();
    // We don't require AWS credentials to be set up — just prove auth is no longer the failure.
    assert(res.status !== 401, `Expected non-401 with valid JWT, got 401. Body: ${text.slice(0, 300)}`);
    const body = JSON.parse(text);
    if (!body.ok) {
      // Acceptable downstream errors when AWS isn't configured for this test user
      assert(
        /AWS credentials not configured|cloud_credentials/i.test(body.error ?? ""),
        `Unexpected post-auth error: ${body.error}`,
      );
    }
  },
});

// ────────────────────────────────────────────────────────────────────────
// Idempotency, dry-run diff, audit-friendly response shape
// ────────────────────────────────────────────────────────────────────────

Deno.test("idempotency: caller-supplied Idempotency-Key is echoed in body + header", async () => {
  const key = `test-${crypto.randomUUID()}`;
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { ...authHeaders(), "Idempotency-Key": key },
    body: JSON.stringify({ dryRun: true, operation: "validate", region: "us-east-1" }),
  });
  const text = await res.text();
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("idempotency-key"), key);
  const body = JSON.parse(text);
  assertEquals(body.idempotencyKey, key);
});

Deno.test("idempotency: server mints a key when caller omits one", async () => {
  const { headers, body } = await postDryRun({ operation: "validate", region: "us-east-1" });
  const headerKey = headers.get("idempotency-key");
  assertExists(headerKey);
  assertEquals(body.idempotencyKey, headerKey);
  // Should look like a UUID
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(headerKey!));
});

Deno.test("idempotency: error responses also include the key", async () => {
  const key = `err-${crypto.randomUUID()}`;
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { ...authHeaders(), "Idempotency-Key": key },
    body: "not-json",
  });
  const text = await res.text();
  assertEquals(res.status, 400);
  assertEquals(res.headers.get("idempotency-key"), key);
  const body = JSON.parse(text);
  assertEquals(body.idempotencyKey, key);
});

Deno.test("dry-run: response includes a diff report (current/desired/changes/summary)", async () => {
  const { body } = await postDryRun({
    operation: "deploy",
    clusterName: "devonn-eks-prod",
    region: "us-east-1",
    nodeCount: 3,
  });
  assertExists(body.diff, "Response should include a diff field");
  assertEquals(body.diff.current, "unknown");
  assertExists(body.diff.desired);
  assertEquals(body.diff.desired.operation, "deploy");
  assertEquals(body.diff.desired.clusterName, "devonn-eks-prod");
  assertEquals(body.diff.desired.nodeCount, 3);
  assert(Array.isArray(body.diff.changes) && body.diff.changes.length > 0);
  // Diff summary aggregates risk + mutation counts
  assertExists(body.diff.summary);
  assertEquals(body.diff.summary.total, body.diff.changes.length);
  assert(body.diff.summary.mutating >= 1, "Deploy diff should have ≥1 mutating action");
  assert(body.diff.summary.highRisk >= 1, "Deploy diff should have ≥1 high-risk action");
});

Deno.test("response shape: includes durationMs for observability", async () => {
  const { body } = await postDryRun({ operation: "validate", region: "us-east-1" });
  assertExists(body.durationMs);
  assert(typeof body.durationMs === "number" && body.durationMs >= 0);
});

Deno.test("response shape: includes structured metrics block", async () => {
  const { body } = await postDryRun({
    operation: "deploy",
    clusterName: "devonn-eks-prod",
    region: "us-east-1",
  });
  assertExists(body.metrics, "Response should include a metrics field");
  assertEquals(body.metrics.dryRun, true);
  assertEquals(body.metrics.operation, "deploy");
  assert(typeof body.metrics.durationMs === "number");
  assert(body.metrics.plannedActionsCount >= 1);
});

Deno.test("backward-compat: response includes plannedActionTitles (string[])", async () => {
  const { body } = await postDryRun({
    operation: "deploy",
    clusterName: "devonn-eks-prod",
    region: "us-east-1",
  });
  assert(Array.isArray(body.plannedActionTitles), "plannedActionTitles must be an array");
  assert(body.plannedActionTitles.every((t: unknown) => typeof t === "string"));
  // Must mirror plannedActions[*].title 1:1 in order — this is the contract
  // older clients/tests will read.
  assertEquals(
    body.plannedActionTitles,
    body.plannedActions.map((a: { title: string }) => a.title),
  );
  assert(body.plannedActionTitles.some((t: string) => /VPC|subnet/i.test(t)));
});

Deno.test("idempotency: response includes expiresAt (~24h from now) in body + header", async () => {
  const before = Date.now();
  const { headers, body } = await postDryRun({ operation: "validate", region: "us-east-1" });
  const after = Date.now();

  assertExists(body.idempotencyExpiresAt, "body should include idempotencyExpiresAt");
  const headerExpires = headers.get("x-idempotency-expires-at");
  assertExists(headerExpires, "response should include X-Idempotency-Expires-At header");
  assertEquals(body.idempotencyExpiresAt, headerExpires);

  const expiresMs = Date.parse(body.idempotencyExpiresAt);
  const ttl = 24 * 60 * 60 * 1000;
  // Expiry should land within [now+ttl-5s, now+ttl+5s] window of the request
  assert(expiresMs >= before + ttl - 5_000, `expiresAt too early: ${body.idempotencyExpiresAt}`);
  assert(expiresMs <= after + ttl + 5_000, `expiresAt too late: ${body.idempotencyExpiresAt}`);
});


// ────────────────────────────────────────────────────────────────────────
// Correlation IDs — request tracing
// ────────────────────────────────────────────────────────────────────────

Deno.test("correlation: caller-supplied X-Correlation-ID is echoed in body + header", async () => {
  const cid = `cid-${crypto.randomUUID()}`;
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { ...authHeaders(), "X-Correlation-ID": cid },
    body: JSON.stringify({ dryRun: true, operation: "validate", region: "us-east-1" }),
  });
  const text = await res.text();
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("x-correlation-id"), cid);
  const body = JSON.parse(text);
  assertEquals(body.correlationId, cid);
});

Deno.test("correlation: server mints a UUID when caller omits the header", async () => {
  const { headers, body } = await postDryRun({ operation: "validate", region: "us-east-1" });
  const headerCid = headers.get("x-correlation-id");
  assertExists(headerCid, "response should carry X-Correlation-ID");
  assertEquals(body.correlationId, headerCid);
  assert(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(headerCid!),
    `correlationId should look like a UUID: ${headerCid}`,
  );
});

Deno.test("correlation: error responses also carry the correlation id", async () => {
  const cid = `err-cid-${crypto.randomUUID()}`;
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { ...authHeaders(), "X-Correlation-ID": cid },
    body: "not-json",
  });
  const text = await res.text();
  assertEquals(res.status, 400);
  assertEquals(res.headers.get("x-correlation-id"), cid);
  const body = JSON.parse(text);
  assertEquals(body.correlationId, cid);
});

Deno.test("CORS: preflight advertises the new tracing headers", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "OPTIONS",
    headers: {
      Origin: "https://example.com",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "x-correlation-id, idempotency-key",
    },
  });
  await res.text();
  assertEquals(res.status, 204);
  const allow = res.headers.get("access-control-allow-headers") ?? "";
  assert(/x-correlation-id/i.test(allow), `Allow-Headers missing x-correlation-id: ${allow}`);
  assert(/idempotency-key/i.test(allow), `Allow-Headers missing idempotency-key: ${allow}`);
  const expose = res.headers.get("access-control-expose-headers") ?? "";
  assert(/x-correlation-id/i.test(expose), `Expose-Headers missing x-correlation-id: ${expose}`);
  assert(/idempotency-key/i.test(expose), `Expose-Headers missing idempotency-key: ${expose}`);
});

// ────────────────────────────────────────────────────────────────────────
// Golden contract — locks the dry-run response shape so future changes
// can't silently break the Devonn dashboard or downstream consumers.
// If you intentionally change the shape, update this test in the SAME PR.
// ────────────────────────────────────────────────────────────────────────

Deno.test("golden contract: dry-run response includes every documented field", async () => {
  const { status, headers, body } = await postDryRun({
    operation: "deploy",
    clusterName: "devonn-eks-prod",
    region: "us-east-1",
    nodeCount: 3,
  });
  assertEquals(status, 200);

  // Top-level envelope
  assertExists(body.ok);
  assertExists(body.success);
  assertExists(body.mode);
  assertEquals(body.mode, "dry-run");

  // Tracing
  assertExists(body.idempotencyKey);
  assertExists(body.idempotencyExpiresAt);
  assertExists(body.correlationId);
  assertExists(headers.get("idempotency-key"));
  assertExists(headers.get("x-idempotency-expires-at"));
  assertExists(headers.get("x-correlation-id"));

  // Standardized metrics
  assertExists(body.metrics);
  for (const k of ["durationMs", "operation", "dryRun", "plannedActionsCount", "mutatingCount", "highRiskCount"]) {
    assert(k in body.metrics, `metrics.${k} is required`);
  }
  assertEquals(body.metrics.dryRun, true);
  assertEquals(body.metrics.operation, "deploy");

  // Planned actions — both rich + back-compat string forms
  assertExists(body.plannedActions);
  assert(Array.isArray(body.plannedActions) && body.plannedActions.length > 0);
  for (const a of body.plannedActions) {
    for (const k of ["id", "title", "type", "risk", "requiresAuth", "mutatesAws"]) {
      assert(k in a, `plannedAction.${k} is required`);
    }
  }
  assertExists(body.plannedActionTitles);
  assertEquals(
    body.plannedActionTitles,
    body.plannedActions.map((a: { title: string }) => a.title),
  );

  // Diff report
  assertExists(body.diff);
  assertEquals(body.diff.current, "unknown");
  assertExists(body.diff.desired);
  assertExists(body.diff.changes);
  assertExists(body.diff.summary);
  for (const k of ["total", "mutating", "highRisk"]) {
    assert(k in body.diff.summary, `diff.summary.${k} is required`);
  }

  // Echo of the request (received block)
  assertExists(body.received);

  // Observability
  assertExists(body.durationMs);
});

// ────────────────────────────────────────────────────────────────────────
// Golden ERROR contract — locks the failure response shape so dashboards
// and CI alerting can rely on a single envelope across every error path.
// If you intentionally change the shape, update this test in the SAME PR.
// ────────────────────────────────────────────────────────────────────────

const ERROR_REQUIRED_KEYS = [
  "ok",
  "success",
  "error",
  "errorType",
  "idempotencyKey",
  "idempotencyExpiresAt",
  "correlationId",
  "metrics",
  "durationMs",
] as const;

const METRICS_REQUIRED_KEYS = [
  "durationMs",
  "operation",
  "dryRun",
  "plannedActionsCount",
  "mutatingCount",
  "highRiskCount",
] as const;

function assertErrorContract(body: Record<string, unknown>) {
  for (const k of ERROR_REQUIRED_KEYS) {
    assert(k in body, `error envelope missing '${k}': ${JSON.stringify(body)}`);
  }
  assertEquals(body.ok, false);
  assertEquals(body.success, false);
  assert(typeof body.error === "string" && body.error.length > 0);
  assert(typeof body.errorType === "string" && (body.errorType as string).length > 0);
  assert(typeof body.idempotencyKey === "string");
  assert(typeof body.idempotencyExpiresAt === "string");
  assert(typeof body.correlationId === "string");
  assert(typeof body.durationMs === "number" && (body.durationMs as number) >= 0);
  const metrics = body.metrics as Record<string, unknown>;
  assert(metrics && typeof metrics === "object", "metrics must be an object");
  for (const k of METRICS_REQUIRED_KEYS) {
    assert(k in metrics, `metrics.${k} is required on error path`);
  }
  assert(typeof metrics.durationMs === "number");
  assert(typeof metrics.operation === "string");
  assert(typeof metrics.dryRun === "boolean");
  assert(typeof metrics.plannedActionsCount === "number");
  assert(typeof metrics.mutatingCount === "number");
  assert(typeof metrics.highRiskCount === "number");
}

Deno.test("error contract [BadRequestError]: invalid JSON → 400 with full envelope", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: authHeaders(),
    body: "{not-json",
  });
  const text = await res.text();
  assertEquals(res.status, 400);
  const body = JSON.parse(text);
  assertErrorContract(body);
  assertEquals(body.errorType, "BadRequestError");
  // Tracing headers must mirror body
  assertEquals(res.headers.get("idempotency-key"), body.idempotencyKey);
  assertEquals(res.headers.get("x-correlation-id"), body.correlationId);
  assertEquals(res.headers.get("x-idempotency-expires-at"), body.idempotencyExpiresAt);
});

Deno.test("error contract [ValidationError]: bad payload → 400 with full envelope + details", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ dryRun: true, operation: "drop-database" }),
  });
  const text = await res.text();
  assertEquals(res.status, 400);
  const body = JSON.parse(text);
  assertErrorContract(body);
  assertEquals(body.errorType, "ValidationError");
  assert(Array.isArray(body.details) && body.details.length > 0);
});

Deno.test("error contract [MethodNotAllowedError]: GET → 405 with full envelope", async () => {
  const res = await fetch(FUNCTION_URL, { method: "GET", headers: authHeaders() });
  const text = await res.text();
  assertEquals(res.status, 405);
  const body = JSON.parse(text);
  assertErrorContract(body);
  assertEquals(body.errorType, "MethodNotAllowedError");
  assertEquals(res.headers.get("x-correlation-id"), body.correlationId);
});

Deno.test("error contract [UnauthorizedError]: real call without JWT → 401 with full envelope", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: authHeaders(), // anon key only — no end-user JWT
    body: JSON.stringify({ operation: "validate", region: "us-east-1" }),
  });
  const text = await res.text();
  assertEquals(res.status, 401);
  const body = JSON.parse(text);
  assertErrorContract(body);
  assertEquals(body.errorType, "UnauthorizedError");
});

Deno.test("error contract: correlation id propagates through every error path", async () => {
  const cases = [
    { name: "bad-json", init: { method: "POST", headers: authHeaders(), body: "{nope" } as RequestInit },
    {
      name: "validation",
      init: {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ dryRun: true, operation: "drop-database" }),
      } as RequestInit,
    },
    { name: "method", init: { method: "GET", headers: authHeaders() } as RequestInit },
    {
      name: "unauthorized",
      init: {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ operation: "validate", region: "us-east-1" }),
      } as RequestInit,
    },
  ];
  for (const c of cases) {
    const cid = `cid-${c.name}-${crypto.randomUUID()}`;
    const headers = { ...(c.init.headers as Record<string, string>), "X-Correlation-ID": cid };
    const res = await fetch(FUNCTION_URL, { ...c.init, headers });
    const text = await res.text();
    assert(res.status >= 400, `${c.name}: expected error status, got ${res.status}`);
    assertEquals(res.headers.get("x-correlation-id"), cid, `${c.name}: header cid mismatch`);
    const body = JSON.parse(text);
    assertEquals(body.correlationId, cid, `${c.name}: body cid mismatch`);
    assertErrorContract(body);
  }
});
