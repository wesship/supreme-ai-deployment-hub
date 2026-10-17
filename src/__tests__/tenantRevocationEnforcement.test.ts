import { describe, expect, it } from "vitest";
import { TenantMiddleware } from "../lib/multi-tenant/tenantMiddleware";
import { TenantRegistry } from "../lib/multi-tenant/tenantRegistry";
import { RateLimiter, UsageMeter } from "../lib/multi-tenant/usageMeter";

async function setup() {
  const registry = new TenantRegistry();
  const tenant = registry.createTenant("Tenant A", "pro");
  const { apiKey, rawKey } = await registry.issueApiKey({
    tenantId: tenant.id, name: "test", scopes: ["read", "execute"],
  });
  const middleware = new TenantMiddleware(registry, new RateLimiter(), new UsageMeter());
  const auth = await middleware.authenticate({
    headers: { authorization: `Bearer ${rawKey}` }, path: "/api/test", method: "GET",
  });
  expect(auth.allowed).toBe(true);
  if (!auth.context) throw new Error("Expected authenticated tenant context");
  return { registry, tenant, apiKey, middleware, context: auth.context };
}

describe("tenant authorization state after authentication", () => {
  it("rejects scope and model checks once the API key is revoked", async () => {
    const { registry, apiKey, middleware, context } = await setup();
    expect(middleware.checkScope(context, "read")).toBe(true);
    expect(middleware.checkModelAccess(context, "gpt-4.1-mini")).toBe(true);
    registry.revokeApiKey(apiKey.id);
    expect(middleware.checkScope(context, "read")).toBe(false);
    expect(middleware.checkModelAccess(context, "gpt-4.1-mini")).toBe(false);
  });

  it("rejects scope and model checks when the tenant is suspended", async () => {
    const { registry, tenant, middleware, context } = await setup();
    registry.updateTenantStatus(tenant.id, "suspended");
    expect(middleware.checkScope(context, "execute")).toBe(false);
    expect(middleware.checkModelAccess(context, "gpt-4.1-mini")).toBe(false);
  });

  it("rejects already-authenticated contexts after key expiry", async () => {
    const { apiKey, middleware, context } = await setup();
    apiKey.expiresAt = new Date(Date.now() - 1000);
    expect(middleware.checkScope(context, "read")).toBe(false);
    expect(middleware.checkModelAccess(context, "gpt-4.1-mini")).toBe(false);
  });

  it("does not authorize a key assigned to another tenant", async () => {
    const { registry, middleware, context } = await setup();
    const other = registry.createTenant("Tenant B");
    expect(middleware.checkScope({ ...context, tenant: other }, "read")).toBe(false);
    expect(middleware.checkModelAccess({ ...context, tenant: other }, "gpt-4.1-nano")).toBe(false);
  });
});
