import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { rateLimit, rateLimitKey, rateLimitResponse } from "../_shared/rateLimit.ts";

// 60 req/min sustained, burst 60 — MCP proxy is per-session chatty.
const RL_CFG = { capacity: 60, refillPerSec: 1 };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-mcp-gateway-url",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface McpProxyRequest {
  method: string;
  params?: Record<string, unknown>;
  gatewayUrl?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const rl = rateLimit(rateLimitKey(req), RL_CFG);
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  try {
    const body: McpProxyRequest = await req.json();
    
    // Get gateway URL from header or body
    const gatewayUrl = req.headers.get("x-mcp-gateway-url") 
      ?? body.gatewayUrl 
      ?? Deno.env.get("MCP_GATEWAY_URL")
      ?? "http://gateway-remote:8080/mcp";

    console.log(`[mcp-gateway] Proxying ${body.method} to ${gatewayUrl}`);

    // Build JSON-RPC request
    const rpcRequest = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: body.method,
      params: body.params ?? {},
    };

    // Forward to MCP Gateway
    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(rpcRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[mcp-gateway] Gateway error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: rpcRequest.id,
          error: {
            code: response.status,
            message: `Gateway error: ${errorText}`,
          },
        }),
        {
          status: 200, // Return 200 with JSON-RPC error
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await response.json();
    console.log(`[mcp-gateway] Response:`, JSON.stringify(result).slice(0, 200));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[mcp-gateway] Error:", error);
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : "Internal error",
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
