import { assertEquals, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { rateLimit, __resetBucketsForTests } from "./rateLimit.ts";

Deno.test("allows up to capacity, then 429s", () => {
  __resetBucketsForTests();
  const cfg = { capacity: 3, refillPerSec: 0.0001 };
  for (let i = 0; i < 3; i++) {
    assert(rateLimit("u1", cfg).allowed, `req ${i} should pass`);
  }
  const denied = rateLimit("u1", cfg);
  assertEquals(denied.allowed, false);
  assert(denied.retryAfterSec >= 1);
});

Deno.test("isolates buckets per key", () => {
  __resetBucketsForTests();
  const cfg = { capacity: 1, refillPerSec: 0.0001 };
  assert(rateLimit("a", cfg).allowed);
  assert(rateLimit("b", cfg).allowed);
  assertEquals(rateLimit("a", cfg).allowed, false);
});

Deno.test("refills over time", async () => {
  __resetBucketsForTests();
  const cfg = { capacity: 1, refillPerSec: 20 }; // 50ms per token
  assert(rateLimit("r", cfg).allowed);
  assertEquals(rateLimit("r", cfg).allowed, false);
  await new Promise((r) => setTimeout(r, 80));
  assert(rateLimit("r", cfg).allowed, "should refill after wait");
});
