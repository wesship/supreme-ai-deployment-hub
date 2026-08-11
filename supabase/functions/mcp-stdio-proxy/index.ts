import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { rateLimit, rateLimitKey, rateLimitResponse } from "../_shared/rateLimit.ts";

const RL_CFG = { capacity: 30, refillPerSec: 0.5 };
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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-mcp-server-id, x-mcp-api-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const STDIO_SERVERS: Record<string, { command: string; args: string[]; envVar?: string }> = {
  hostinger: { command: "npx", args: ["hostinger-api-mcp@latest"], envVar: "API_TOKEN" },
  github: { command: "npx", args: ["@modelcontextprotocol/server-github"], envVar: "GITHUB_TOKEN" },
  filesystem: { command: "npx", args: ["@modelcontextprotocol/server-filesystem", "/tmp"] },
  slack: { command: "npx", args: ["@modelcontextprotocol/server-slack"], envVar: "SLACK_TOKEN" },
  puppeteer: { command: "npx", args: ["@modelcontextprotocol/server-puppeteer"] },
  brave: { command: "npx", args: ["@modelcontextprotocol/server-brave-search"], envVar: "BRAVE_API_KEY" },
};

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

  const stdioGatewayUrl = Deno.env.get("MCP_STDIO_GATEWAY_URL");
  if (!stdioGatewayUrl) {
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32603, message: "MCP stdio gateway is not configured" },
    }), {
      status: 503,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    if (body?.jsonrpc !== "2.0" || typeof body?.method !== "string") {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: body?.id ?? null,
        error: { code: -32600, message: "Invalid JSON-RPC request" },
      }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const serverId = req.headers.get("x-mcp-server-id");
    const apiToken = req.headers.get("x-mcp-api-token");
    const serverConfig = serverId ? STDIO_SERVERS[serverId] : undefined;

    if (!serverId || !serverConfig) {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: body.id ?? null,
        error: { code: -32602, message: "Unknown or missing MCP server ID" },
      }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (serverConfig.envVar && !apiToken) {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: body.id ?? null,
        error: { code: -32602, message: `API token required for ${serverId}` },
      }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(stdioGatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": req.headers.get("Authorization") ?? "",
        "X-MCP-Server-Id": serverId,
        "X-MCP-Command": serverConfig.command,
        "X-MCP-Args": JSON.stringify(serverConfig.args),
        ...(apiToken && serverConfig.envVar ? { [`X-MCP-Env-${serverConfig.envVar}`]: apiToken } : {}),
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
