import { describe, expect, it, vi } from "vitest";
import { createHealthSnapshot } from "../../api/status-health";

describe("status health API", () => {
  it("checks the backend once and reports the same-origin frontend", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "healthy", version: "2.4.0" }),
    });

    const snapshot = await createHealthSnapshot(
      fetcher,
      "https://api.example.test/",
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.example.test/health",
      expect.objectContaining({ method: "GET" }),
    );
    expect(snapshot.services).toEqual([
      expect.objectContaining({ id: "frontend", status: "online" }),
      expect.objectContaining({
        id: "api-health",
        status: "online",
        details: "v2.4.0 • healthy",
      }),
    ]);
  });

  it("does not invent Redis, AI, or orchestration health from one API probe", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    const snapshot = await createHealthSnapshot(
      fetcher,
      "https://api.example.test",
    );

    expect(snapshot.services.map((service) => service.id)).toEqual([
      "frontend",
      "api-health",
    ]);
    expect(snapshot.services[1]).toEqual(
      expect.objectContaining({
        status: "offline",
        error: "Health endpoint unreachable",
      }),
    );
  });

  it("classifies an unhealthy HTTP response as degraded", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    const snapshot = await createHealthSnapshot(
      fetcher,
      "https://api.example.test",
    );

    expect(snapshot.services[1]).toEqual(
      expect.objectContaining({
        status: "degraded",
        error: "Health endpoint returned HTTP 503",
      }),
    );
  });
});
