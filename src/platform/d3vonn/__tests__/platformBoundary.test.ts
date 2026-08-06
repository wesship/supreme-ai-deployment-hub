import { describe, expect, it, vi } from "vitest";
import { readBrowserSafeConfig } from "../config";
import { D3vonnClient } from "../sdk";

const event = {
  id: "evt-1",
  workspaceId: "workspace-1",
  eventType: "lead.created",
  aggregateType: "lead",
  aggregateId: "lead-1",
  eventVersion: 1,
  occurredAt: "2026-08-06T00:00:00Z",
  payload: { source: "test" },
};

describe("D3VONN platform boundary", () => {
  it("reads only browser-safe Vite configuration", () => {
    expect(
      readBrowserSafeConfig({
        VITE_ENVIRONMENT: "staging",
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "publishable",
        VITE_API_URL: "https://api.example.com",
      }),
    ).toEqual({
      environment: "staging",
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "publishable",
      apiUrl: "https://api.example.com",
    });
  });

  it("publishes typed domain events through the API boundary", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    const client = new D3vonnClient({
      baseUrl: "https://api.example.com",
      token: "test-token",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.publishEvent(event);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.example.com/api/events",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
