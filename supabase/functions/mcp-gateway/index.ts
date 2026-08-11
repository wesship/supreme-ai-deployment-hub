import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { rateLimit, rateLimitKey, rateLimitResponse } from "../_shared/rateLimit.ts";

const RL_CFG = { capacity: 60, refillPerSec: 1 };
const ALLOWED_ORIGINS = new Set([
  "https://www.d3vonn.io",
  "https://d3vonn.io",
  "https://app.d3vonn.io",
]);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    ...(ALLOWED_ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-mcp-server-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

serve(async (req) => {
  const cors = corsHeaders(req);
  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return new Response(JSON.stringify({ error: "origin_not_allowed" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const rl = rateLimit(rateLimitKey(req), RL_CFG);
  if (!rl.allowed) return rateLimitResponse(rl, cors);

  const gatewayUrl = Deno.env.get("MCP_GATEWAY_URL");
  if (!gatewayUrl) {
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32603, message: "MCP gateway is not configured" },
    }), {
      status: 503,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json() as JsonRpcRequest;
    if (body.jsonrpc !== "2.0" || typeof body.method !== "string") {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: body.id ?? null,
        error: { code: -32600, message: "Invalid JSON-RPC request" },
      }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": req.headers.get("Authorization") ?? "",
        "X-MCP-Server-Id": req.headers.get("x-mcp-server-id") ?? "devonn-gateway",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    const responseText = await response.text();
    return new Response(responseText, {
      status: response.status,
      headers: { ...cors, "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32603, message },
    }), {
      status: 502,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
