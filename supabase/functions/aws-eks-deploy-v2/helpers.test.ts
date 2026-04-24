// Pure unit tests for helpers.ts.
// These do NOT hit the network or boot serve() — fast and offline-safe.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  buildIdempotencyExpiry,
  buildMetrics,
  getDryRunDiff,
  getPlannedActions,
  IDEMPOTENCY_DEFAULT_TTL_MS,
  IDEMPOTENCY_MAX_TTL_MS,
  IDEMPOTENCY_MIN_TTL_MS,
} from "./helpers.ts";

// ────────────────────────────────────────────────────────────────────────────
// getDryRunDiff
// ────────────────────────────────────────────────────────────────────────────

Deno.test("diff [deploy]: summary counts mutating + high-risk actions", () => {
  const body = { operation: "deploy", clusterName: "c1", region: "us-east-1" };
  const planned = getPlannedActions(body);
  const diff = getDryRunDiff(body, planned);

  assertEquals(diff.current, "unknown");
  assertEquals(diff.desired, body);
  assertEquals(diff.changes, planned);
  assertEquals(diff.summary.total, planned.length);
  assertEquals(
    diff.summary.mutating,
    planned.filter((a) => a.mutatesAws).length,
  );
  assertEquals(
    diff.summary.highRisk,
    planned.filter((a) => a.risk === "high").length,
  );
  // Deploy: at least one mutating + one high-risk
  assert(diff.summary.mutating >= 1);
  assert(diff.summary.highRisk >= 1);
});

Deno.test("diff [validate]: read-only plan has zero mutating + zero high-risk", () => {
  const body = { operation: "validate", region: "us-east-1" };
  const planned = getPlannedActions(body);
  const diff = getDryRunDiff(body, planned);

  assertEquals(diff.summary.mutating, 0);
  assertEquals(diff.summary.highRisk, 0);
  assertEquals(diff.summary.total, planned.length);
});

Deno.test("diff [delete]: includes a delete-typed mutating action", () => {
  const body = { operation: "delete", clusterName: "c1", region: "us-east-1" };
  const planned = getPlannedActions(body);
  const diff = getDryRunDiff(body, planned);

  const del = planned.find((a) => a.type === "delete");
  assert(del, "delete plan must include a delete-typed action");
  assertEquals(del?.mutatesAws, true);
  assertEquals(del?.risk, "high");
  assert(diff.summary.mutating >= 1);
  assert(diff.summary.highRisk >= 1);
});

Deno.test("diff: unique action ids per plan (no accidental dupes)", () => {
  for (const op of ["validate", "deploy", "status", "list-clusters", "delete"]) {
    const planned = getPlannedActions({ operation: op });
    const ids = planned.map((a) => a.id);
    assertEquals(
      new Set(ids).size,
      ids.length,
      `duplicate action ids for op=${op}: ${ids.join(", ")}`,
    );
  }
});

// ────────────────────────────────────────────────────────────────────────────
// buildMetrics
// ────────────────────────────────────────────────────────────────────────────

Deno.test("metrics: stable shape mirrors planned-action counts", () => {
  const body = { operation: "deploy", dryRun: true };
  const planned = getPlannedActions(body);
  const m = buildMetrics(body, planned, 42);

  assertEquals(m.durationMs, 42);
  assertEquals(m.operation, "deploy");
  assertEquals(m.dryRun, true);
  assertEquals(m.plannedActionsCount, planned.length);
  assertEquals(m.mutatingCount, planned.filter((a) => a.mutatesAws).length);
  assertEquals(m.highRiskCount, planned.filter((a) => a.risk === "high").length);
});

Deno.test("metrics: defaults operation='deploy' and dryRun=false", () => {
  const planned = getPlannedActions({});
  const m = buildMetrics({}, planned, 0);
  assertEquals(m.operation, "deploy");
  assertEquals(m.dryRun, false);
});

// ────────────────────────────────────────────────────────────────────────────
// buildIdempotencyExpiry — clamping
// ────────────────────────────────────────────────────────────────────────────

const NOW = Date.parse("2026-01-01T00:00:00.000Z");

Deno.test("expiry: default TTL produces ISO timestamp ~24h ahead", () => {
  const iso = buildIdempotencyExpiry(NOW, IDEMPOTENCY_DEFAULT_TTL_MS);
  assertEquals(iso, new Date(NOW + IDEMPOTENCY_DEFAULT_TTL_MS).toISOString());
});

Deno.test("expiry: TTL below floor is clamped UP to MIN_TTL", () => {
  const iso = buildIdempotencyExpiry(NOW, 0);
  assertEquals(iso, new Date(NOW + IDEMPOTENCY_MIN_TTL_MS).toISOString());
});

Deno.test("expiry: negative TTL is clamped UP to MIN_TTL (never in the past)", () => {
  const iso = buildIdempotencyExpiry(NOW, -10_000);
  const expiresMs = Date.parse(iso);
  assert(expiresMs > NOW, `expiry must be > now, got ${iso}`);
  assertEquals(iso, new Date(NOW + IDEMPOTENCY_MIN_TTL_MS).toISOString());
});

Deno.test("expiry: TTL above ceiling is clamped DOWN to MAX_TTL", () => {
  const iso = buildIdempotencyExpiry(NOW, 365 * 24 * 60 * 60 * 1000);
  assertEquals(iso, new Date(NOW + IDEMPOTENCY_MAX_TTL_MS).toISOString());
});

Deno.test("expiry: non-finite TTL falls back to default", () => {
  const iso = buildIdempotencyExpiry(NOW, NaN);
  assertEquals(iso, new Date(NOW + IDEMPOTENCY_DEFAULT_TTL_MS).toISOString());
});
