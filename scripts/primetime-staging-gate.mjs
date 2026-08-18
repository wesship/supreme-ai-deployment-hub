#!/usr/bin/env node
/**
 * PRIMETIME Release 6 staging-readiness gate.
 *
 * This runner performs only unauthenticated GET requests. It proves that the
 * deployed frontend exposes the certified PRIMETIME routes, the API is live,
 * protected PRIMETIME data cannot be read anonymously, and prohibited endpoint
 * fragments are absent. It never creates, changes, or deletes regulated data.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { pathToFileURL } from "node:url";

export const REQUIRED_FRONTEND_ROUTES = Object.freeze([
  "/primetime",
  "/primetime/release-1",
  "/primetime/scheduling",
  "/primetime/release-2",
  "/primetime/communications",
  "/primetime/release-3",
  "/primetime/ai-assistance",
  "/primetime/release-4",
  "/primetime/executive-command-center",
  "/primetime/release-5",
]);

export const PROTECTED_API_ROUTE = "/primetime/v1/workspaces";
export const BLOCKED_API_ROUTES = Object.freeze([
  "/primetime/v1/send",
  "/primetime/v1/quote",
  "/primetime/v1/recommend-policy",
  "/primetime/v1/submit-application",
]);

const DEFAULT_TIMEOUT_MS = 10_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 30_000;

function usage() {
  return `Usage: node scripts/primetime-staging-gate.mjs [options]

Required configuration (arguments take precedence over environment variables):
  --frontend-url <https-url>  PRIMETIME frontend staging base URL
  --api-url <https-url>       PRIMETIME API staging base URL

Optional:
  --timeout-ms <number>       Per-request timeout (${MIN_TIMEOUT_MS}-${MAX_TIMEOUT_MS} ms)
  --allow-http-local          Permit http://localhost only for local verification
  --help                      Show this help

Environment variables:
  PRIMETIME_STAGING_FRONTEND_URL
  PRIMETIME_STAGING_API_URL
  PRIMETIME_GATE_TIMEOUT_MS
`;
}

function parseOptions(argv) {
  const options = { allowHttpLocal: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") {
      options.help = true;
      continue;
    }
    if (argument === "--allow-http-local") {
      options.allowHttpLocal = true;
      continue;
    }
    if (["--frontend-url", "--api-url", "--timeout-ms"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a value.`);
      }
      options[argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${argument}`);
  }

  return options;
}

function isLoopbackOrPrivateIp(hostname) {
  const address = hostname.replace(/^\[|\]$/g, "");
  const version = isIP(address);
  if (version === 4) {
    const [first, second] = address.split(".").map(Number);
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
  }
  return false;
}

function isLocalDevelopmentHost(hostname) {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || isLoopbackOrPrivateIp(normalized);
}

export function validateBaseUrl(value, label, { allowHttpLocal = false } = {}) {
  if (!value) {
    throw new Error(`${label} is required.`);
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute URL.`);
  }

  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not contain credentials.`);
  }
  if (parsed.search || parsed.hash) {
    throw new Error(`${label} must not contain a query string or fragment.`);
  }

  const isLocal = isLocalDevelopmentHost(parsed.hostname);
  if (parsed.protocol !== "https:" && !(allowHttpLocal && isLocal && parsed.protocol === "http:")) {
    throw new Error(`${label} must use HTTPS. HTTP is allowed only for explicit local verification.`);
  }
  if (isLocal && !allowHttpLocal) {
    throw new Error(`${label} must not target localhost or a private IP address outside explicit local verification.`);
  }

  parsed.pathname = parsed.pathname.replace(/\/$/, "");
  return parsed;
}

export async function assertPublicDnsTarget(url, { allowHttpLocal = false } = {}) {
  if (allowHttpLocal && isLocalDevelopmentHost(url.hostname)) {
    return;
  }

  if (isIP(url.hostname)) {
    if (isLoopbackOrPrivateIp(url.hostname)) {
      throw new Error(`Refusing private network target: ${url.hostname}`);
    }
    return;
  }

  let records;
  try {
    records = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new Error(`Unable to resolve ${url.hostname}; verify the staging URL and DNS configuration.`);
  }

  if (!records.length || records.some((record) => isLoopbackOrPrivateIp(record.address))) {
    throw new Error(`Refusing a staging target that resolves to a private network address: ${url.hostname}`);
  }
}

function buildUrl(baseUrl, route) {
  const url = new URL(baseUrl.toString());
  const basePath = url.pathname.replace(/\/$/, "");
  url.pathname = `${basePath}${route}`.replace(/\/{2,}/g, "/");
  url.search = "";
  url.hash = "";
  return url;
}

function parseTimeout(value) {
  const timeout = Number(value ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isInteger(timeout) || timeout < MIN_TIMEOUT_MS || timeout > MAX_TIMEOUT_MS) {
    throw new Error(`timeout must be an integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS} milliseconds.`);
  }
  return timeout;
}

async function request(url, { timeoutMs, accept }) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "error",
    headers: { Accept: accept },
    signal: AbortSignal.timeout(timeoutMs),
  });

  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    body: await response.text(),
  };
}

function ensureHtml(response, route) {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${route} returned HTTP ${response.status}; expected a successful frontend response.`);
  }
  if (!response.contentType.toLowerCase().includes("text/html")) {
    throw new Error(`${route} returned ${response.contentType || "no Content-Type"}; expected text/html.`);
  }
  if (!response.body.toLowerCase().includes("<html")) {
    throw new Error(`${route} did not return an HTML document.`);
  }
}

function ensureHealthyApi(response) {
  if (response.status !== 200) {
    throw new Error(`/health returned HTTP ${response.status}; expected 200.`);
  }
  if (!response.contentType.toLowerCase().includes("application/json")) {
    throw new Error(`/health returned ${response.contentType || "no Content-Type"}; expected application/json.`);
  }

  let payload;
  try {
    payload = JSON.parse(response.body);
  } catch {
    throw new Error("/health returned invalid JSON.");
  }
  if (!payload || typeof payload !== "object" || !["ok", "healthy", "degraded"].includes(String(payload.status).toLowerCase())) {
    throw new Error("/health did not return an acceptable health status.");
  }
}

function ensureProtectedRoute(response) {
  if (![401, 403].includes(response.status)) {
    throw new Error(`${PROTECTED_API_ROUTE} returned HTTP ${response.status}; anonymous PRIMETIME access must be denied with 401 or 403.`);
  }
}

function ensureBlockedRoute(response, route) {
  if (![404, 405].includes(response.status)) {
    throw new Error(`${route} returned HTTP ${response.status}; prohibited PRIMETIME endpoint fragments must be absent.`);
  }
}

function formatResult(label, status) {
  return `${status === "PASS" ? "PASS" : "FAIL"}  ${label}`;
}

export async function runChecks({ frontendUrl, apiUrl, timeoutMs = DEFAULT_TIMEOUT_MS, allowHttpLocal = false, logger = console } = {}) {
  const frontendBase = validateBaseUrl(frontendUrl, "frontend URL", { allowHttpLocal });
  const apiBase = validateBaseUrl(apiUrl, "API URL", { allowHttpLocal });
  const timeout = parseTimeout(timeoutMs);

  await assertPublicDnsTarget(frontendBase, { allowHttpLocal });
  await assertPublicDnsTarget(apiBase, { allowHttpLocal });

  const checks = [];
  const check = async (label, operation) => {
    try {
      await operation();
      checks.push({ label, status: "PASS" });
      logger.log(formatResult(label, "PASS"));
    } catch (error) {
      checks.push({ label, status: "FAIL", error: error instanceof Error ? error.message : String(error) });
      logger.error(`${formatResult(label, "FAIL")} — ${checks.at(-1).error}`);
    }
  };

  for (const route of REQUIRED_FRONTEND_ROUTES) {
    await check(`frontend ${route}`, async () => {
      const response = await request(buildUrl(frontendBase, route), { timeoutMs: timeout, accept: "text/html" });
      ensureHtml(response, route);
    });
  }

  await check("API /health", async () => {
    const response = await request(buildUrl(apiBase, "/health"), { timeoutMs: timeout, accept: "application/json" });
    ensureHealthyApi(response);
  });

  await check(`protected ${PROTECTED_API_ROUTE}`, async () => {
    const response = await request(buildUrl(apiBase, PROTECTED_API_ROUTE), { timeoutMs: timeout, accept: "application/json" });
    ensureProtectedRoute(response);
  });

  for (const route of BLOCKED_API_ROUTES) {
    await check(`blocked endpoint ${route}`, async () => {
      const response = await request(buildUrl(apiBase, route), { timeoutMs: timeout, accept: "application/json" });
      ensureBlockedRoute(response, route);
    });
  }

  const failures = checks.filter((checkResult) => checkResult.status === "FAIL");
  logger.log(`\nPRIMETIME Release 6 staging gate: ${checks.length - failures.length}/${checks.length} checks passed.`);
  if (failures.length) {
    const summary = failures.map((failure) => `${failure.label}: ${failure.error}`).join("; ");
    throw new Error(`PRIMETIME staging gate failed: ${summary}`);
  }

  return checks;
}

export function configurationFromEnvironment(argv = process.argv.slice(2), env = process.env) {
  const options = parseOptions(argv);
  if (options.help) {
    return { help: true };
  }

  return {
    frontendUrl: options.frontendUrl ?? env.PRIMETIME_STAGING_FRONTEND_URL,
    apiUrl: options.apiUrl ?? env.PRIMETIME_STAGING_API_URL,
    timeoutMs: options.timeoutMs ?? env.PRIMETIME_GATE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS,
    allowHttpLocal: options.allowHttpLocal,
  };
}

async function main() {
  const configuration = configurationFromEnvironment();
  if (configuration.help) {
    process.stdout.write(usage());
    return;
  }
  await runChecks(configuration);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`PRIMETIME Release 6 staging gate failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
