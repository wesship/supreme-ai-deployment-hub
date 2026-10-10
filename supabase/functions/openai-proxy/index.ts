// Edge function that proxies OpenAI chat completions using a server-side API key.
// The OPENAI_API_KEY secret is read from the environment and never exposed to the client.

import { rateLimit, rateLimitKey, rateLimitResponse } from "../_shared/rateLimit.ts";

// 30 req/min sustained, burst 30 — keyed per Bearer token or IP.
const RL_CFG = { capacity: 30, refillPerSec: 30 / 60 };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

interface ProxyBody {
  model: string;
  messages: unknown;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: unknown;
  tool_choice?: unknown;
  response_format?: unknown;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const rl = rateLimit(rateLimitKey(req), RL_CFG);
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.error("[openai-proxy] OPENAI_API_KEY not configured");
    return jsonResponse({ error: "OPENAI_API_KEY is not configured on the server" }, 500);
  }

  let body: ProxyBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body || typeof body !== "object" || !body.model || !Array.isArray(body.messages)) {
    return jsonResponse({ error: "Body must include 'model' and 'messages[]'" }, 400);
  }

  // Whitelist forwarded fields to keep the proxy explicit
  const upstreamPayload: Record<string, unknown> = {
    model: body.model,
    messages: body.messages,
    temperature: body.temperature ?? 0.7,
    max_tokens: body.max_tokens ?? 4096,
  };
  if (body.stream) upstreamPayload.stream = true;
  if (body.tools) upstreamPayload.tools = body.tools;
  if (body.tool_choice) upstreamPayload.tool_choice = body.tool_choice;
  if (body.response_format) upstreamPayload.response_format = body.response_format;

  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(upstreamPayload),
    });
  } catch (err) {
    console.error("[openai-proxy] network error contacting OpenAI:", err);
    return jsonResponse(
      { error: "Failed to reach OpenAI", details: err instanceof Error ? err.message : String(err) },
      502,
    );
  }

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => "<unreadable>");
    console.error(`[openai-proxy] OpenAI ${upstream.status}: ${errText.slice(0, 500)}`);
    return new Response(errText, {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }

  // Streaming: pipe SSE body straight through with CORS headers
  if (body.stream && upstream.body) {
    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Non-streaming: forward the JSON body
  const text = await upstream.text();
  return new Response(text, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
