import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "INVALID_TOKEN" }, 401);

    const body = await req.json();
    const shadowRunId = body?.shadow_run_id;
    if (!shadowRunId || typeof shadowRunId !== "string") {
      return json({ error: "shadow_run_id required" }, 400);
    }

    const { data: rows, error } = await userClient.rpc(
      "nonprofit_validate_production_preflight",
      { p_shadow_run_id: shadowRunId },
    );

    if (error) return json({ error: error.message, code: "PREFLIGHT_BLOCKED" }, 403);

    const result = Array.isArray(rows) ? rows[0] : rows;
    if (!result) return json({ error: "PREFLIGHT_RESULT_MISSING" }, 500);

    return json({
      shadow_run_id: result.shadow_run_id,
      promotion_id: result.promotion_id,
      request_body_hash: result.request_body_hash,
      shadow_certified: result.shadow_certified,
      execution_token_status: result.execution_token_status,
      execution_token_expires_at: result.execution_token_expires_at,
      preflight_status: result.preflight_status,
      production_send_available: false,
      token_plaintext_exposed: false,
      token_issued_by_this_function: false,
      network_probe_performed: false,
      application_payload_transmitted: false,
      production_execution_enabled: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
    return json({
      error: message,
      production_send_available: false,
      token_plaintext_exposed: false,
      token_issued_by_this_function: false,
      network_probe_performed: false,
      application_payload_transmitted: false,
      production_execution_enabled: false,
    }, 500);
  }
});
