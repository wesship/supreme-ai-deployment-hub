/**
 * ai-proxy — D3VONN Supabase Edge Function
 *
 * A secure proxy for OpenAI API calls that:
 *   1. Validates the user's Supabase JWT before forwarding the request
 *   2. Enforces per-user rate limiting (10 requests/minute)
 *   3. Never exposes the OPENAI_API_KEY to the frontend
 *   4. Logs all requests for observability
 *
 * Deploy: supabase functions deploy ai-proxy --project-ref <project-id>
 *
 * Required secrets (set in Supabase Dashboard → Edge Functions → Secrets):
 *   OPENAI_API_KEY  — OpenAI API key
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Token-bucket: 10 req/min sustained, burst of 10.
const RL_CFG = { capacity: 10, refillPerSec: 10 / 60 };


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Health check endpoint
  const url = new URL(req.url);
  if (url.pathname.endsWith("/health")) {
    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ── 1. Authenticate the user ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Rate limit per user (token bucket) ────────────────────────────────
    const rl = rateLimit(user.id, RL_CFG);
    if (!rl.allowed) {
      return rateLimitResponse(rl, { ...corsHeaders });
    }


    // ── 3. Parse and validate the request body ────────────────────────────────
    const body = await req.json();
    if (!body.messages || !Array.isArray(body.messages)) {
      return new Response(JSON.stringify({ error: "Invalid request: messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 4. Forward to OpenAI ──────────────────────────────────────────────────
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: body.model || "gpt-4.1-mini",
        messages: body.messages,
        max_tokens: Math.min(body.max_tokens || 1000, 4000), // cap at 4000
        temperature: body.temperature ?? 0.7,
        stream: false, // streaming not supported in this proxy version
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error(`OpenAI API error: ${openaiResponse.status} — ${errorText}`);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await openaiResponse.json();

    // ── 5. Log usage for observability ────────────────────────────────────────
    console.log(JSON.stringify({
      event: "ai_proxy_request",
      user_id: user.id,
      model: data.model,
      prompt_tokens: data.usage?.prompt_tokens,
      completion_tokens: data.usage?.completion_tokens,
    }));

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Unexpected error in ai-proxy:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
