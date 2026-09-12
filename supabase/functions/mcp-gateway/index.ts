import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { rateLimit, rateLimitKey, rateLimitResponse } from "../_shared/rateLimit.ts";

// 60 req/min sustained, burst 60 — MCP proxy is per-session chatty.
const RL_CFG = { capacity: 60, refillPerSec: 1 };
const REQUEST_TIMEOUT_MS = 10_000;
const ALLOWED_ORIGIN = Deno.env.get("MCP_GATEWAY_ALLOWED_ORIGIN") ?? "https://d3vonn.io";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

interface McpProxyRequest {
  method: string;
  params?: Record<string, unknown>;
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.startsWith("fe80:") ||
    host.startsWith("fc") ||
    host.startsWith("fd")
  ) {
    return true;
  }

  const octets = host.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19))
  );
}

function configuredGatewayUrl(): URL {
  const configured = Deno.env.get("MCP_GATEWAY_URL");
  if (!configured) {
    throw new Error("MCP gateway is not configured");
  }

  let target: URL;
  try {
    target = new URL(configured);
  } catch {
    throw new Error("MCP gateway configuration is invalid");
  }

  if (target.protocol !== "https:" || isPrivateOrLocalHostname(target.hostname)) {
    throw new Error("MCP gateway configuration must use a public HTTPS endpoint");
  }
  return target;
}

function rpcError(id: number | null, code: number, message: string): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: { code, message },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return rpcError(null, -32600, "POST is required");
  }

  const rl = rateLimit(rateLimitKey(req), RL_CFG);
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  let requestId: number | null = null;
  try {
    const body: McpProxyRequest = await req.json();
    if (!body || typeof body.method !== "string" || !body.method.trim()) {
      return rpcError(null, -32600, "A JSON-RPC method is required");
    }

    const target = configuredGatewayUrl();
    requestId = Date.now();
    const rpcRequest = {
      jsonrpc: "2.0",
      id: requestId,
      method: body.method,
      params: body.params ?? {},
    };

    const response = await fetch(target, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rpcRequest),
    });

    if (!response.ok) {
      console.error(`[mcp-gateway] Configured gateway returned HTTP ${response.status}`);
      return rpcError(requestId, -32000, "Configured gateway request failed");
    }

    const result = await response.json();
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof DOMException && error.name === "TimeoutError"
      ? "Configured gateway request timed out"
      : "MCP gateway request failed";
    console.error("[mcp-gateway]", message);
    return rpcError(requestId, -32603, message);
  }
});
