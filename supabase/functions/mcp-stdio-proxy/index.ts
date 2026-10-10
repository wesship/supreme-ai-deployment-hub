import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-mcp-server-id, x-mcp-api-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface StdioProxyRequest {
  serverId: string;
  method: string;
  params?: Record<string, unknown>;
}

// Map of supported stdio MCP servers and their configurations
const STDIO_SERVERS: Record<string, { command: string; args: string[]; envVar?: string }> = {
  hostinger: {
    command: "npx",
    args: ["hostinger-api-mcp@latest"],
    envVar: "API_TOKEN",
  },
  github: {
    command: "npx",
    args: ["@modelcontextprotocol/server-github"],
    envVar: "GITHUB_TOKEN",
  },
  filesystem: {
    command: "npx",
    args: ["@modelcontextprotocol/server-filesystem", "/tmp"],
  },
  slack: {
    command: "npx",
    args: ["@modelcontextprotocol/server-slack"],
    envVar: "SLACK_TOKEN",
  },
  puppeteer: {
    command: "npx",
    args: ["@modelcontextprotocol/server-puppeteer"],
  },
  brave: {
    command: "npx",
    args: ["@modelcontextprotocol/server-brave-search"],
    envVar: "BRAVE_API_KEY",
  },
};

/**
 * MCP Stdio Proxy Edge Function
 * 
 * This function proxies requests to stdio-based MCP servers.
 * Since we can't spawn processes in Edge Functions, this acts as a relay
 * to a separate MCP gateway service that can run the stdio processes.
 * 
 * In production, you would configure MCP_STDIO_GATEWAY_URL to point to
 * a service running Docker MCP Gateway or similar.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: StdioProxyRequest = await req.json();
    const { serverId, method, params } = body;

    // Get API token from header
    const apiToken = req.headers.get("x-mcp-api-token");

    // Validate server ID
    const serverConfig = STDIO_SERVERS[serverId];
    if (!serverConfig) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          error: {
            code: -32602,
            message: `Unknown server: ${serverId}. Available: ${Object.keys(STDIO_SERVERS).join(", ")}`,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if API token is required but not provided
    if (serverConfig.envVar && !apiToken) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          error: {
            code: -32602,
            message: `API token required for ${serverId}`,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the stdio gateway URL from environment
    const stdioGatewayUrl = Deno.env.get("MCP_STDIO_GATEWAY_URL");
    
    if (!stdioGatewayUrl) {
      // If no gateway is configured, return a helpful error
      console.log(`[mcp-stdio-proxy] No MCP_STDIO_GATEWAY_URL configured for ${serverId}`);
      
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          error: {
            code: -32603,
            message: "Stdio proxy gateway not configured. Please set MCP_STDIO_GATEWAY_URL.",
            data: {
              hint: "Deploy a Docker MCP Gateway and set the MCP_STDIO_GATEWAY_URL secret",
              serverId,
              serverConfig,
            },
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build the proxy request to the stdio gateway
    const rpcRequest = {
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params: params ?? {},
    };

    // Forward to stdio gateway with server configuration
    const response = await fetch(stdioGatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MCP-Server-Id": serverId,
        "X-MCP-Command": serverConfig.command,
        "X-MCP-Args": JSON.stringify(serverConfig.args),
        ...(apiToken && serverConfig.envVar
          ? { [`X-MCP-Env-${serverConfig.envVar}`]: apiToken }
          : {}),
      },
      body: JSON.stringify(rpcRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[mcp-stdio-proxy] Gateway error: ${response.status} - ${errorText}`);
      
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: rpcRequest.id,
          error: {
            code: response.status,
            message: `Stdio gateway error: ${errorText}`,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await response.json();
    console.log(`[mcp-stdio-proxy] Response for ${serverId}:`, JSON.stringify(result).slice(0, 200));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[mcp-stdio-proxy] Error:", error);
    
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
