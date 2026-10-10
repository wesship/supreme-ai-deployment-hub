// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import {
  BLOCKED_API_ROUTES,
  PROTECTED_API_ROUTE,
  REQUIRED_FRONTEND_ROUTES,
  configurationFromEnvironment,
  runChecks,
  validateBaseUrl,
} from "../../scripts/primetime-staging-gate.mjs";

let server;
let baseUrl;
let protectedRouteStatus = 401;
const logger = { log() {}, error() {} };

beforeAll(
  () =>
    new Promise((resolve) => {
      server = createServer((request, response) => {
        const path = new URL(request.url ?? "/", "http://localhost").pathname;

        if (path === "/health") {
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ status: "ok" }));
          return;
        }

        if (path === PROTECTED_API_ROUTE) {
          response.writeHead(protectedRouteStatus, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ detail: "Authentication required" }));
          return;
        }

        if (BLOCKED_API_ROUTES.includes(path)) {
          response.writeHead(404, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ detail: "Not found" }));
          return;
        }

        if (REQUIRED_FRONTEND_ROUTES.includes(path)) {
          response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          response.end("<!doctype html><html><head><title>PRIMETIME</title></head><body>PRIMETIME</body></html>");
          return;
        }

        response.writeHead(404, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ detail: "Not found" }));
      });

      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    }),
);

afterAll(
  () =>
    new Promise((resolve) => {
      server.close(resolve);
    }),
);

describe("PRIMETIME Release 6 staging gate", () => {
  it("passes only after all certified frontend, health, protected-route, and blocked-route checks pass", async () => {
    protectedRouteStatus = 401;

    const results = await runChecks({
      frontendUrl: baseUrl,
      apiUrl: baseUrl,
      timeoutMs: 1_000,
      allowHttpLocal: true,
      logger,
    });

    expect(results).toHaveLength(REQUIRED_FRONTEND_ROUTES.length + BLOCKED_API_ROUTES.length + 2);
    expect(results.every((result) => result.status === "PASS")).toBe(true);
  });

  it("fails closed if anonymous access to the protected PRIMETIME API becomes successful", async () => {
    protectedRouteStatus = 200;

    await expect(
      runChecks({
        frontendUrl: baseUrl,
        apiUrl: baseUrl,
        timeoutMs: 1_000,
        allowHttpLocal: true,
        logger,
      }),
    ).rejects.toThrow("anonymous PRIMETIME access must be denied");

    protectedRouteStatus = 401;
  });

  it("rejects credentials, private network targets, and non-HTTPS production targets", () => {
    expect(() => validateBaseUrl("https://user:secret@example.com", "frontend URL")).toThrow("must not contain credentials");
    expect(() => validateBaseUrl("https://127.0.0.1", "frontend URL")).toThrow("must not target localhost or a private IP");
    expect(() => validateBaseUrl("http://staging.example.com", "frontend URL")).toThrow("must use HTTPS");
  });

  it("allows HTTP only for explicitly requested local verification", () => {
    const url = validateBaseUrl("http://localhost:4173/", "frontend URL", { allowHttpLocal: true });
    expect(url.toString()).toBe("http://localhost:4173/");
  });

  it("reads argument values ahead of environment values", () => {
    const config = configurationFromEnvironment(
      ["--frontend-url", "https://argument.example.com", "--api-url", "https://api.argument.example.com"],
      {
        PRIMETIME_STAGING_FRONTEND_URL: "https://environment.example.com",
        PRIMETIME_STAGING_API_URL: "https://api.environment.example.com",
      },
    );

    expect(config.frontendUrl).toBe("https://argument.example.com");
    expect(config.apiUrl).toBe("https://api.argument.example.com");
  });
});
